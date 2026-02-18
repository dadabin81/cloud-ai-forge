
-- Rate limiting function: max 5 inserts per IP-equivalent (email) per hour
CREATE OR REPLACE FUNCTION public.check_insert_rate_limit(table_name text, check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF table_name = 'contact_messages' THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.contact_messages
    WHERE email = check_email
      AND created_at > now() - interval '1 hour';
  ELSIF table_name = 'waitlist' THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.waitlist
    WHERE email = check_email
      AND created_at > now() - interval '1 hour';
  ELSE
    RETURN false;
  END IF;
  
  RETURN recent_count < 5;
END;
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

-- New rate-limited INSERT policies
CREATE POLICY "Rate-limited contact message submissions"
ON public.contact_messages
FOR INSERT
WITH CHECK (
  char_length(name) BETWEEN 1 AND 100
  AND char_length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND char_length(subject) BETWEEN 1 AND 200
  AND char_length(message) BETWEEN 1 AND 2000
  AND public.check_insert_rate_limit('contact_messages', email)
);

CREATE POLICY "Rate-limited waitlist signups"
ON public.waitlist
FOR INSERT
WITH CHECK (
  char_length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND public.check_insert_rate_limit('waitlist', email)
);
