import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { ProjectFile } from '@/lib/projectGenerator';
import { parseProjectFiles, generateFileTree } from '@/lib/projectGenerator';
import { hasIncrementalMarkers, parseIncrementalActions, applyIncrementalActions, smartMergeFiles } from '@/lib/incrementalParser';
import { extractCodeBlocks, isRenderableCode, hasProjectMarkers, hasOnlyNonWebCode } from '@/lib/codeExtractor';
import { parseBlueprintResponse, type Blueprint } from '@/lib/blueprintSystem';

const LOCAL_FILES_KEY = 'binario_local_files';
const LOCAL_PROJECT_KEY = 'binario_local_project_name';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface UseProjectSyncOptions {
  messages: Message[];
  isAuthenticated: boolean;
  project: { id: string; name: string } | null;
  saveFiles: (files: Record<string, ProjectFile>) => void;
  createProject: (name: string, files: Record<string, ProjectFile>) => Promise<any>;
  firstUserMessageRef: React.MutableRefObject<string | null>;
}

export function useProjectSync({
  messages,
  isAuthenticated,
  project,
  saveFiles,
  createProject,
  firstUserMessageRef,
}: UseProjectSyncOptions) {
  // Restore files from localStorage on init
  const [projectFiles, setProjectFiles] = useState<Record<string, ProjectFile>>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_FILES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [currentBlueprint, setCurrentBlueprint] = useState<Blueprint | null>(null);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'planning' | 'generating'>('idle');

  const fileTree = useMemo(() => generateFileTree(projectFiles), [projectFiles]);
  const totalFiles = Object.keys(projectFiles).length;
  const activeFileData = activeFile ? projectFiles[activeFile] : null;

  // Persist files to localStorage as fallback
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      try {
        if (Object.keys(projectFiles).length > 0) {
          localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(projectFiles));
        } else {
          localStorage.removeItem(LOCAL_FILES_KEY);
        }
      } catch { /* quota exceeded — ignore */ }
    }, 300);
    return () => { if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current); };
  }, [projectFiles]);

  // Auto-detect project files from latest assistant message
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;

    if (hasIncrementalMarkers(lastAssistant.content)) {
      const actions = parseIncrementalActions(lastAssistant.content);
      if (actions.length > 0) {
        const updatedFiles = applyIncrementalActions(projectFiles, actions);
        setProjectFiles(updatedFiles);
        const firstChanged = actions.find(a => a.type !== 'delete');
        if (firstChanged) setActiveFile(firstChanged.path);
        if (project) saveFiles(updatedFiles);
        return;
      }
    }

    if (hasProjectMarkers(lastAssistant.content)) {
      const newFiles = parseProjectFiles(lastAssistant.content);
      if (Object.keys(newFiles).length > 0) {
        const mergedFiles = smartMergeFiles(projectFiles, newFiles);
        setProjectFiles(mergedFiles);
        const firstFile = Object.keys(newFiles)[0];
        setActiveFile(firstFile);
        if (project) {
          saveFiles(mergedFiles);
        } else if (isAuthenticated && firstUserMessageRef.current) {
          createProject(firstUserMessageRef.current, mergedFiles).then(newProj => {
            if (newProj) saveFiles(mergedFiles);
          });
        }
        setCurrentPhase('idle');
        return;
      }
    }

    const blueprint = parseBlueprintResponse(lastAssistant.content);
    if (blueprint) {
      setCurrentBlueprint(blueprint);
      setCurrentPhase('planning');
      return;
    }

    const blocks = extractCodeBlocks(lastAssistant.content);
    if (isRenderableCode(blocks)) {
      const virtualFiles: Record<string, ProjectFile> = {};
      blocks.forEach((block, i) => {
        const ext = block.language === 'css' ? 'css' : block.language === 'html' || block.language === 'htm' ? 'html' : block.language === 'jsx' || block.language === 'tsx' ? 'jsx' : 'js';
        const name = blocks.length === 1 ? `index.${ext}` : `file${i + 1}.${ext}`;
        virtualFiles[name] = { code: block.code, language: block.language };
      });
      const merged = smartMergeFiles(projectFiles, virtualFiles);
      setProjectFiles(merged);
      setActiveFile(Object.keys(virtualFiles)[0]);
    } else if (hasOnlyNonWebCode(lastAssistant.content)) {
      toast.warning('El AI generó código no-web (Python/Java). Envía un mensaje pidiendo que lo genere como app web con HTML/CSS/React.');
    }
  }, [messages]);

  const handleCodeChange = useCallback((filename: string, newCode: string) => {
    setProjectFiles(prev => {
      const updated = { ...prev, [filename]: { ...prev[filename], code: newCode } };
      if (project) saveFiles(updated);
      return updated;
    });
  }, [project, saveFiles]);

  const handleImportProject = useCallback((importedFiles: Record<string, ProjectFile>, name: string) => {
    setProjectFiles(importedFiles);
    const firstFile = Object.keys(importedFiles)[0];
    if (firstFile) setActiveFile(firstFile);
    if (isAuthenticated) {
      createProject(name, importedFiles);
    }
  }, [isAuthenticated, createProject]);

  const resetProject = useCallback(() => {
    setProjectFiles({});
    setActiveFile(null);
    setCurrentBlueprint(null);
    setCurrentPhase('idle');
    localStorage.removeItem(LOCAL_FILES_KEY);
    localStorage.removeItem(LOCAL_PROJECT_KEY);
  }, []);

  const loadFiles = useCallback((files: Record<string, ProjectFile>) => {
    setProjectFiles(files);
    const firstFile = Object.keys(files)[0];
    if (firstFile) setActiveFile(firstFile);
  }, []);

  return {
    projectFiles,
    setProjectFiles,
    activeFile,
    setActiveFile,
    activeFileData,
    fileTree,
    totalFiles,
    currentBlueprint,
    setCurrentBlueprint,
    currentPhase,
    setCurrentPhase,
    handleCodeChange,
    handleImportProject,
    resetProject,
    loadFiles,
  };
}
