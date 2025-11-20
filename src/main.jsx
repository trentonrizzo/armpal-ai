import React from "react";
import ReactDOM from "react-dom/client";
<<<<<<< HEAD
import App from "./App";
import "./index.css";
=======
import { BrowserRouter } from "react-router-dom";
>>>>>>> d2232ea (Added progress graph page)

import App from "./App";
import { AppProvider } from "./context/AppContext";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
<<<<<<< HEAD
    <App />
=======
    <AppProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProvider>
>>>>>>> d2232ea (Added progress graph page)
  </React.StrictMode>
);
