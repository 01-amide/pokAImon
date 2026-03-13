import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// ⏸️ WORKSHOP STEP 5: Add Context
// TODO: Import ThemeProvider from './context/ThemeContext.jsx'

import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* ⏸️ WORKSHOP STEP 5: Wrap in ThemeProvider */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  
  </React.StrictMode>
);
