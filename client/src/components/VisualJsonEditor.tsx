import React from 'react';

interface Props {
  data: any;
  onChange: (newData: any) => void;
  label?: string;
}

export default function VisualJsonEditor({ data, onChange, label }: Props) {
  const isObject = (val: any) => val !== null && typeof val === 'object' && !Array.isArray(val);
  const isArray = (val: any) => Array.isArray(val);

  const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Try to parse as number if it looks like one, else keep string
    if (!isNaN(Number(val)) && val.trim() !== '') {
      onChange(Number(val));
    } else {
      onChange(val);
    }
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const newData = { ...data };
    newData[newKey] = newData[oldKey];
    delete newData[oldKey];
    onChange(newData);
  };

  const handleObjectValueChange = (key: string, newValue: any) => {
    const newData = { ...data };
    newData[key] = newValue;
    onChange(newData);
  };

  const handleArrayValueChange = (index: number, newValue: any) => {
    const newData = [...data];
    newData[index] = newValue;
    onChange(newData);
  };

  const deleteObjectKey = (key: string) => {
    const newData = { ...data };
    delete newData[key];
    onChange(newData);
  };

  const deleteArrayItem = (index: number) => {
    const newData = [...data];
    newData.splice(index, 1);
    onChange(newData);
  };

  const addArrayItem = () => {
    const newData = [...(data || [])];
    newData.push(''); // Default new item
    onChange(newData);
  };

  const addObjectKey = () => {
    const newData = { ...(data || {}) };
    let newKey = 'new_field';
    let counter = 1;
    while (newData[newKey]) {
      newKey = `new_field_${counter++}`;
    }
    newData[newKey] = '';
    onChange(newData);
  };

  // Primitive value
  if (!isObject(data) && !isArray(data)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', width: '100%' }}>
        {label && <strong style={{ minWidth: '120px', fontSize: '0.85rem', color: '#475569' }}>{label}:</strong>}
        <input 
          type="text" 
          value={data === undefined || data === null ? '' : data.toString()} 
          onChange={handleStringChange}
          style={{ flex: 1, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
        />
      </div>
    );
  }

  // Array
  if (isArray(data)) {
    return (
      <div style={{ marginLeft: label ? '16px' : '0', marginBottom: '8px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
        {label && <strong style={{ fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '4px' }}>{label} [Array]:</strong>}
        {data.map((item: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>{index}.</span>
            <div style={{ flex: 1 }}>
              <VisualJsonEditor data={item} onChange={(v) => handleArrayValueChange(index, v)} />
            </div>
            <button 
              onClick={() => deleteArrayItem(index)}
              style={{ padding: '2px 6px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
              title="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          onClick={addArrayItem}
          style={{ padding: '4px 8px', background: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '4px' }}
        >
          + Add Item
        </button>
      </div>
    );
  }

  // Object
  return (
    <div style={{ marginLeft: label ? '16px' : '0', marginBottom: '8px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
      {label && <strong style={{ fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '4px' }}>{label}:</strong>}
      {Object.keys(data || {}).map((key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <input 
            type="text" 
            value={key} 
            onChange={(e) => handleKeyChange(key, e.target.value)}
            style={{ width: '120px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', background: '#f8fafc', fontWeight: 600 }}
          />
          <div style={{ flex: 1 }}>
            <VisualJsonEditor data={data[key]} onChange={(v) => handleObjectValueChange(key, v)} />
          </div>
          <button 
            onClick={() => deleteObjectKey(key)}
            style={{ padding: '2px 6px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            title="Remove property"
          >
            ✕
          </button>
        </div>
      ))}
      <button 
        onClick={addObjectKey}
        style={{ padding: '4px 8px', background: '#f1f5f9', color: '#10b981', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '4px' }}
      >
        + Add Property
      </button>
    </div>
  );
}
