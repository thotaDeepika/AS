import type { ColumnDef } from '../lib/constants';

interface DynamicColumnEditorProps {
  columns: ColumnDef[];
  onChange: (columns: ColumnDef[]) => void;
}

export function DynamicColumnEditor({ columns, onChange }: DynamicColumnEditorProps) {
  const handleAddColumn = () => {
    onChange([...columns, { key: '', label: '', type: 'text', is_mandatory: false }]);
  };

  const handleUpdate = (index: number, field: keyof ColumnDef, value: any) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    if (field === 'type' && value === 'select' && !newCols[index].options) {
      newCols[index].options = [];
    }
    onChange(newCols);
  };

  const handleRemove = (index: number) => {
    const newCols = columns.filter((_, i) => i !== index);
    onChange(newCols);
  };

  const handleOptionsChange = (index: number, value: string) => {
    const newCols = [...columns];
    newCols[index].options = value.split(',').map(s => s.trim()).filter(Boolean);
    onChange(newCols);
  };

  return (
    <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px' }}>Label</th>
            <th style={{ padding: '8px' }}>Key (JSON field)</th>
            <th style={{ padding: '8px' }}>Type</th>
            <th style={{ padding: '8px' }}>Options (comma separated)</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Mandatory</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '4px' }}>
                <input type="text" value={col.label} onChange={e => handleUpdate(idx, 'label', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g. Paper Title" />
              </td>
              <td style={{ padding: '4px' }}>
                <input type="text" value={col.key} onChange={e => handleUpdate(idx, 'key', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g. paperTitle" />
              </td>
              <td style={{ padding: '4px' }}>
                <select value={col.type} onChange={e => handleUpdate(idx, 'type', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select</option>
                  <option value="boolean">Boolean</option>
                  <option value="file">File Upload</option>
                </select>
              </td>
              <td style={{ padding: '4px' }}>
                <input 
                  type="text" 
                  value={col.options?.join(', ') || ''} 
                  onChange={e => handleOptionsChange(idx, e.target.value)} 
                  disabled={col.type !== 'select'}
                  style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: col.type !== 'select' ? '#f1f5f9' : 'white' }} 
                  placeholder="Option 1, Option 2" 
                />
              </td>
              <td style={{ padding: '4px', textAlign: 'center' }}>
                <input type="checkbox" checked={col.is_mandatory} onChange={e => handleUpdate(idx, 'is_mandatory', e.target.checked)} />
              </td>
              <td style={{ padding: '4px', textAlign: 'center' }}>
                <button type="button" onClick={() => handleRemove(idx)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={handleAddColumn} style={{ marginTop: '0.5rem', padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Column</button>
    </div>
  );
}
