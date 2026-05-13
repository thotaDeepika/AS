import { useCallback, useState, useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  uploading?: boolean;
  uploadedFile?: { name: string; size: number } | null;
  onRemove?: () => void;
}

export default function FileUpload({
  onFileSelect,
  accept = '.pdf',
  maxSizeMB = 10,
  uploading = false,
  uploadedFile = null,
  onRemove,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    onFileSelect(file);
  }, [onFileSelect, accept, maxSizeMB]);

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

  if (uploadedFile) {
    return (
      <div className="file-upload-done">
        <span className="file-icon">📄</span>
        <div className="file-info">
          <span className="file-name">{uploadedFile.name}</span>
          <span className="file-size">{formatSize(uploadedFile.size)}</span>
        </div>
        {onRemove && (
          <button className="file-remove" onClick={onRemove} title="Remove file">✕</button>
        )}
      </div>
    );
  }

  return (
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
          <span className="upload-hint">PDF only, max {maxSizeMB}MB</span>
        </>
      )}
      {error && <span className="upload-error">{error}</span>}
    </div>
  );
}
