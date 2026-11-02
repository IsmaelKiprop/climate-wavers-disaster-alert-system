import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import "@radix-ui/themes/styles.css";
import "./index.css";
import { NotificationProvider } from "./context/NotificationContext";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <App />
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </NotificationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
