import { useCallback, useState, useRef } from 'react';

interface UploadedFile {
  id?: string;
  name: string;
  size: number;
}

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  uploading?: boolean;
  uploadedFiles?: UploadedFile[];
  onRemove?: (index: number) => void;
  // Legacy single-file support
  uploadedFile?: { name: string; size: number } | null;
}

export default function FileUpload({
  onFileSelect,
  accept = '.pdf',
  maxSizeMB = 10,
  maxFiles = 1,
  uploading = false,
  uploadedFiles = [],
  onRemove,
  uploadedFile = null,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge legacy single-file prop into uploadedFiles list
  const allFiles: UploadedFile[] = uploadedFile
    ? [{ name: uploadedFile.name, size: uploadedFile.size }]
    : uploadedFiles;

  const atLimit = allFiles.length >= maxFiles;

  const validateAndSelect = useCallback((file: File) => {
    setError('');
    if (accept === '.pdf' && file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }
    if (atLimit) {
      setError(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`);
      return;
    }
    onFileSelect(file);
  }, [onFileSelect, accept, maxSizeMB, maxFiles, atLimit]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }, [validateAndSelect]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="file-upload-container">
      {/* Show uploaded files */}
      {allFiles.map((f, idx) => (
        <div key={idx} className="file-upload-done">
          <span className="file-icon">📄</span>
          <div className="file-info">
            <span className="file-name">{f.name}</span>
            <span className="file-size">{formatSize(f.size)}</span>
          </div>
          {onRemove && (
            <button className="file-remove" onClick={() => onRemove(idx)} title="Remove file">✕</button>
          )}
        </div>
      ))}

      {/* Upload zone (hidden when at limit) */}
      {!atLimit && (
        <div
          className={`file-upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) validateAndSelect(file);
              if (inputRef.current) inputRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          {uploading ? (
            <div className="upload-progress">
              <div className="loader-spinner" />
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <span className="upload-icon">📎</span>
              <span className="upload-text">
                <strong>Click to upload</strong> or drag and drop
              </span>
              <span className="upload-hint">
                PDF only, max {maxSizeMB}MB
                {maxFiles > 1 && ` (${allFiles.length}/${maxFiles} files)`}
              </span>
            </>
          )}
          {error && <span className="upload-error">{error}</span>}
        </div>
      )}

      {/* At limit message */}
      {atLimit && !uploading && (
        <span className="upload-limit-text">
          ✓ {maxFiles} file{maxFiles > 1 ? 's' : ''} uploaded (max reached)
        </span>
      )}
    </div>
  );
}
