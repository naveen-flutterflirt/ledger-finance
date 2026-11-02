import React from 'react';
import { useParams } from 'react-router-dom';
import DocForm from '../../components/common/DocForm.js';
import { DOC_CONFIG } from '../../utils/constants.js';

export default function NewDoc() {
  const { kind = 'sales' } = useParams<{ kind: string }>();
  const meta = DOC_CONFIG[kind];

  return (
    <>
      <div className="topbar">
        <h1>New {meta?.one.toLowerCase()}</h1>
      </div>
      <DocForm kind={kind} />
    </>
  );
}

