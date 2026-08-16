import type { ColumnDef } from '../lib/constants';
import FileUpload from './FileUpload';

interface DynamicCategoryTableProps {
  sl: number;
  columns: ColumnDef[];
  data: any[];
  isDraft: boolean;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onChange: (index: number, field: string, value: any) => void;
  onFetchDoi?: (doi: string, index: number) => void;
  
  // For file uploads
  onUpload?: (file: File, itemIndex: number) => Promise<void>;
  onRemoveProof?: (proofId: string) => Promise<void>;
  proofs?: any[];
  uploading?: boolean;
  maxAttachments?: number;
  
  addButtonText?: string;
  emptyText?: string;
  hideUpload?: boolean;
}

export function DynamicCategoryTable({
  sl,
  columns,
  data,
  isDraft,
  onAddRow,
  onRemoveRow,
  onChange,
  onFetchDoi,
  onUpload,
  onRemoveProof,
  proofs = [],
  uploading = false,
  maxAttachments = 1,
  addButtonText = '+ Add Row',
  emptyText = 'No entries added. Click "+ Add Row" below to start.',
  hideUpload = false
}: DynamicCategoryTableProps) {
  
  return (
    <>
      <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
          <thead style={{ backgroundColor: '#f1f5f9' }}>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                  {col.label} {col.is_mandatory && <span style={{ color: '#ef4444' }}>*</span>}
                </th>
              ))}
              {!hideUpload && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>}
              {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + (hideUpload ? 0 : 1) + (isDraft ? 1 : 0)} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                  {emptyText}
                </td>
              </tr>
            )}
            {data.map((row, index) => (
              <tr key={index}>
                {columns.map(col => {
                  const val = row[col.key] ?? '';
                  const status = row.status || 'Published'; // specifically for publication overrides
                  
                  // SMART OVERRIDES
                  
                  // 1. DOI with fetch button (for publications)
                  if (col.key === 'doi' && sl >= 2 && sl <= 4) {
                    return (
                      <td key={col.key} style={{ border: '1px solid #333', padding: '8px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            value={val}
                            onChange={e => onChange(index, col.key, e.target.value)}
                            disabled={!isDraft}
                            placeholder={status === 'Accepted' ? 'Pending (Optional)' : 'DOI'}
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                          {isDraft && status !== 'Accepted' && onFetchDoi && (
                            <button type="button" onClick={() => onFetchDoi(val, index)} style={{ padding: '6px 8px', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                              Fetch
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  }
                  
                  // 2. Expected Publication Date (conditionally hidden if Published)
                  if (col.key === 'expectedPublicationDate' && sl >= 2 && sl <= 4) {
                    return (
                      <td key={col.key} style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                        {status === 'Accepted' ? (
                          <input
                            type="date"
                            value={val}
                            onChange={e => onChange(index, col.key, e.target.value)}
                            disabled={!isDraft}
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>N/A</span>
                        )}
                      </td>
                    );
                  }

                  // 3. Conditionally hidden for 'Accepted' papers
                  if (['issn', 'isbn', 'journalCategory'].includes(col.key) && sl >= 2 && sl <= 4) {
                    return (
                      <td key={col.key} style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        {status === 'Accepted' ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending</span>
                        ) : (
                          col.type === 'select' ? (
                            <select value={val} onChange={e => onChange(index, col.key, e.target.value)} disabled={!isDraft} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
                              <option value="">Select</option>
                              {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input
                              type={col.type === 'date' ? 'date' : (col.type === 'number' ? 'number' : 'text')}
                              value={val}
                              onChange={e => onChange(index, col.key, e.target.value)}
                              disabled={!isDraft}
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          )
                        )}
                      </td>
                    );
                  }

                  // Default rendering
                  return (
                    <td key={col.key} style={{ border: '1px solid #333', padding: '8px' }}>
                      {col.type === 'select' ? (
                        <select
                          value={val}
                          onChange={e => onChange(index, col.key, e.target.value)}
                          disabled={!isDraft}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                        >
                          <option value="">Select</option>
                          {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={col.type === 'date' ? 'date' : (col.type === 'number' ? 'number' : 'text')}
                          value={val}
                          onChange={e => onChange(index, col.key, e.target.value)}
                          disabled={!isDraft}
                          placeholder={col.label}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                        />
                      )}
                    </td>
                  );
                })}

                {/* Upload cell */}
                {!hideUpload && (
                  <td style={{ border: '1px solid #333', padding: '8px', minWidth: '200px' }}>
                    {(() => {
                      const itemProofs = proofs.filter((p: any) => p.item_index === index);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {itemProofs.map((proof: any) => (
                            <div key={proof.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.8rem' }}>
                              <a href={proof.file_path} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proof.file_name}>
                                {proof.file_name}
                              </a>
                              {isDraft && onRemoveProof && (
                                <button type="button" onClick={() => onRemoveProof(proof.id)} style={{ padding: '2px 6px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          {isDraft && itemProofs.length < maxAttachments && onUpload && (
                            <FileUpload
                              onFileSelect={(file: File) => onUpload(file, index)}
                              maxSizeMB={5}
                              accept=".pdf,.jpg,.jpeg,.png"
                              uploading={uploading}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </td>
                )}

                {/* Action cell */}
                {isDraft && (
                  <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => onRemoveRow(index)} 
                      style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isDraft && (
        <button 
          type="button" 
          onClick={onAddRow} 
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold', display: 'inline-block' }}
        >
          {addButtonText}
        </button>
      )}
    </>
  );
}
