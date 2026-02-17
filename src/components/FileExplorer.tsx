import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, FileText, FileJson, File, FolderOpen, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileTreeNode } from '@/lib/projectGenerator';

interface FileExplorerProps {
  tree: FileTreeNode[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  totalFiles: number;
}

const FILE_ICONS: Record<string, { icon: typeof FileCode; className: string }> = {
  html: { icon: FileCode, className: 'text-orange-400' },
  htm: { icon: FileCode, className: 'text-orange-400' },
  css: { icon: FileCode, className: 'text-blue-400' },
  javascript: { icon: FileCode, className: 'text-yellow-400' },
  js: { icon: FileCode, className: 'text-yellow-400' },
  jsx: { icon: FileCode, className: 'text-yellow-400' },
  tsx: { icon: FileCode, className: 'text-cyan-400' },
  typescript: { icon: FileCode, className: 'text-cyan-400' },
  json: { icon: FileJson, className: 'text-green-400' },
  markdown: { icon: FileText, className: 'text-gray-400' },
  svg: { icon: FileCode, className: 'text-purple-400' },
};

function getFileIcon(language?: string) {
  const entry = language ? FILE_ICONS[language] : undefined;
  return entry || { icon: File, className: 'text-muted-foreground' };
}

function TreeNode({ node, activeFile, onFileSelect, depth = 0 }: {
  node: FileTreeNode;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = node.type === 'folder';
  const isActive = node.path === activeFile;
  const { icon: Icon, className: iconClass } = getFileIcon(node.language);

  return (
    <div>
      <button
        onClick={() => isFolder ? setIsOpen(!isOpen) : onFileSelect(node.path)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs hover:bg-secondary/80 rounded transition-colors',
          isActive && 'bg-primary/10 text-primary',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-yellow-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <Icon className={cn('w-3.5 h-3.5 shrink-0', iconClass)} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && isOpen && node.children?.map(child => (
        <TreeNode key={child.path} node={child} activeFile={activeFile} onFileSelect={onFileSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export function FileExplorer({ tree, activeFile, onFileSelect, totalFiles }: FileExplorerProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
        <span className="text-xs text-muted-foreground">{totalFiles} files</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            No project files yet. Chat with the AI to generate a project.
          </div>
        ) : (
          tree.map(node => (
            <TreeNode key={node.path} node={node} activeFile={activeFile} onFileSelect={onFileSelect} />
          ))
        )}
      </div>
    </div>
  );
}
