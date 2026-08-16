export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'file';
  options?: string[];
  is_mandatory: boolean;
}

export const CATEGORY_COLUMNS: Record<number, ColumnDef[]> = {
  1: [
    { key: 'academic_year', label: 'Academic Year', type: 'text', is_mandatory: true },
    { key: 'subjects', label: 'Subjects', type: 'text', is_mandatory: true },
    { key: 'academic_score', label: 'Academic Score', type: 'number', is_mandatory: true },
    { key: 'attitude', label: 'Attitude', type: 'number', is_mandatory: true },
    { key: 'discipline', label: 'Discipline', type: 'number', is_mandatory: true }
  ],
  2: [
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] },
    { key: 'doi', label: 'DOI', type: 'text', is_mandatory: true },
    { key: 'paperTitle', label: 'Paper Title', type: 'text', is_mandatory: true },
    { key: 'authorDetails', label: 'Author', type: 'text', is_mandatory: true },
    { key: 'journalName', label: 'Journal Name', type: 'text', is_mandatory: true },
    { key: 'publicationDate', label: 'Publication Date', type: 'date', is_mandatory: true },
    { key: 'issn', label: 'ISSN', type: 'text', is_mandatory: true },
    { key: 'journalCategory', label: 'Journal Category', type: 'select', is_mandatory: true, options: ['Q1', 'Q2', 'Q3', 'Q4'] },
    { key: 'expectedPublicationDate', label: 'Expected Pub Date', type: 'date', is_mandatory: true }
  ],
  3: [
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] },
    { key: 'doi', label: 'DOI', type: 'text', is_mandatory: true },
    { key: 'paperTitle', label: 'Paper Title', type: 'text', is_mandatory: true },
    { key: 'authorDetails', label: 'Author', type: 'text', is_mandatory: true },
    { key: 'journalName', label: 'Conference Name', type: 'text', is_mandatory: true },
    { key: 'publisher', label: 'Publisher', type: 'text', is_mandatory: true },
    { key: 'publicationDate', label: 'Year', type: 'date', is_mandatory: true },
    { key: 'isbn', label: 'ISBN', type: 'text', is_mandatory: true },
    { key: 'issn', label: 'ISSN', type: 'text', is_mandatory: true },
    { key: 'expectedPublicationDate', label: 'Expected Year', type: 'date', is_mandatory: true }
  ],
  4: [
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] },
    { key: 'doi', label: 'DOI', type: 'text', is_mandatory: true },
    { key: 'paperTitle', label: 'Paper Title', type: 'text', is_mandatory: true },
    { key: 'authorDetails', label: 'Author', type: 'text', is_mandatory: true },
    { key: 'journalName', label: 'Conference Name', type: 'text', is_mandatory: true },
    { key: 'publisher', label: 'Publisher', type: 'text', is_mandatory: true },
    { key: 'publicationDate', label: 'Year', type: 'date', is_mandatory: true },
    { key: 'isbn', label: 'ISBN', type: 'text', is_mandatory: true },
    { key: 'issn', label: 'ISSN', type: 'text', is_mandatory: true },
    { key: 'expectedPublicationDate', label: 'Expected Year', type: 'date', is_mandatory: true }
  ],
  5: [
    { key: 'bookType', label: 'Book Type', type: 'select', is_mandatory: true, options: ['Book', 'Book Chapter', 'Edited Book', 'Text Book'] },
    { key: 'title', label: 'Title', type: 'text', is_mandatory: true },
    { key: 'authors', label: 'Authors', type: 'text', is_mandatory: true },
    { key: 'publisher', label: 'Publisher', type: 'text', is_mandatory: true },
    { key: 'isbn', label: 'ISBN', type: 'text', is_mandatory: true },
    { key: 'publicationDate', label: 'Publication Date', type: 'date', is_mandatory: true }
  ],
  6: [
    { key: 'title', label: 'Title', type: 'text', is_mandatory: true },
    { key: 'disclosureNo', label: 'Disclosure No.', type: 'text', is_mandatory: true },
    { key: 'filingDate', label: 'Filing Date', type: 'text', is_mandatory: true }
  ],
  7: [
    { key: 'title', label: 'Title', type: 'text', is_mandatory: true },
    { key: 'patentNo', label: 'Patent No.', type: 'text', is_mandatory: true },
    { key: 'country', label: 'Country', type: 'text', is_mandatory: true },
    { key: 'grantDate', label: 'Grant Date', type: 'text', is_mandatory: true }
  ],
  8: [
    { key: 'studentName', label: 'Student Name', type: 'text', is_mandatory: true },
    { key: 'programme', label: 'Programme', type: 'text', is_mandatory: true },
    { key: 'researchTitle', label: 'Research Title', type: 'text', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] }
  ],
  9: [
    { key: 'studentName', label: 'Student Name', type: 'text', is_mandatory: true },
    { key: 'programme', label: 'Programme', type: 'text', is_mandatory: true },
    { key: 'researchTitle', label: 'Research Title', type: 'text', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] }
  ],
  10: [
    { key: 'studentName', label: 'Student Name', type: 'text', is_mandatory: true },
    { key: 'programme', label: 'Programme', type: 'text', is_mandatory: true },
    { key: 'researchTitle', label: 'Research Title', type: 'text', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'status', label: 'Status', type: 'select', is_mandatory: true, options: ['Published', 'Accepted'] }
  ],

  11: [
    { key: 'title', label: 'Project Title', type: 'text', is_mandatory: true },
    { key: 'agency', label: 'Funding Agency', type: 'text', is_mandatory: true },
    { key: 'amount', label: 'Amount (Lakhs ₹)', type: 'number', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'duration', label: 'Duration / Status', type: 'text', is_mandatory: true }
  ],
  12: [
    { key: 'title', label: 'Project Title', type: 'text', is_mandatory: true },
    { key: 'agency', label: 'Client / Org', type: 'text', is_mandatory: true },
    { key: 'amount', label: 'Amount (Lakhs ₹)', type: 'number', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'duration', label: 'Duration / Status', type: 'text', is_mandatory: true }
  ],
  13: [
    { key: 'activityType', label: 'Activity Type (Reviewer/Chair)', type: 'text', is_mandatory: true },
    { key: 'name', label: 'Conference/Journal Name', type: 'text', is_mandatory: true },
    { key: 'date', label: 'Date', type: 'date', is_mandatory: true },
    { key: 'description', label: 'Description', type: 'text', is_mandatory: true }
  ],
  14: [
    { key: 'name', label: 'Title', type: 'text', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'startDate', label: 'Start Date', type: 'date', is_mandatory: true },
    { key: 'endDate', label: 'End Date', type: 'date', is_mandatory: true },
    { key: 'organization', label: 'Place', type: 'text', is_mandatory: true }
  ],
  15: [
    { key: 'name', label: 'Talk Title', type: 'text', is_mandatory: true },
    { key: 'organization', label: 'Organization', type: 'text', is_mandatory: true },
    { key: 'date', label: 'Date', type: 'date', is_mandatory: true }
  ],
  16: [
    { key: 'name', label: 'Name', type: 'text', is_mandatory: true },
    { key: 'organization', label: 'Organization', type: 'text', is_mandatory: true },
    { key: 'startDate', label: 'Start Date', type: 'date', is_mandatory: true },
    { key: 'endDate', label: 'End Date', type: 'date', is_mandatory: true }
  ],
  17: [
    { key: 'name', label: 'Name', type: 'text', is_mandatory: true },
    { key: 'organization', label: 'Department', type: 'text', is_mandatory: true },
    { key: 'startDate', label: 'Start Date', type: 'date', is_mandatory: true },
    { key: 'endDate', label: 'End Date', type: 'date', is_mandatory: true }
  ],
  18: [
    { key: 'name', label: 'Industry Name', type: 'text', is_mandatory: true },
    { key: 'activityType', label: 'Activity Type', type: 'text', is_mandatory: true },
    { key: 'date', label: 'Date', type: 'date', is_mandatory: true },
    { key: 'description', label: 'Description', type: 'text', is_mandatory: true }
  ],
  19: [
    { key: 'description', label: 'Description / Responsibility', type: 'text', is_mandatory: true },
    { key: 'level', label: 'Level', type: 'select', options: ['Department', 'Institute'], is_mandatory: true }
  ],
  20: [
    { key: 'description', label: 'Description / Contribution', type: 'text', is_mandatory: true },
    { key: 'committee', label: 'Committee / Activity Name', type: 'text', is_mandatory: true },
    { key: 'duration', label: 'Date / Duration', type: 'text', is_mandatory: true }
  ],
  21: [
    { key: 'awardName', label: 'Award Name', type: 'text', is_mandatory: true },
    { key: 'agency', label: 'Awarding Agency', type: 'text', is_mandatory: true },
    { key: 'year', label: 'Year / Date', type: 'text', is_mandatory: true },
    { key: 'level', label: 'Level', type: 'select', options: ['State', 'National', 'International'], is_mandatory: true }
  ],
  22: [
    { key: 'activity', label: 'Description of Activity', type: 'text', is_mandatory: true },
    { key: 'duration', label: 'Date / Duration', type: 'text', is_mandatory: true }
  ],
  23: [
    { key: 'description', label: 'Contribution Description', type: 'text', is_mandatory: true },
    { key: 'role', label: 'Role', type: 'text', is_mandatory: true },
    { key: 'duration', label: 'Date / Duration', type: 'text', is_mandatory: true }
  ]
};
