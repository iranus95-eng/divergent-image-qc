import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CostWorkspace from './CostWorkspace';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CostWorkspace />
  </StrictMode>,
);
