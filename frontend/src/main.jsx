import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import "@radix-ui/themes/styles.css";
import "./index.css";
import { NotificationProvider } from "./context/NotificationContext";
import { FollowProvider } from "./context/FollowContext";
import { SidebarProvider } from "./context/SidebarContext";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <FollowProvider>
          <SidebarProvider>
            <App />
          </SidebarProvider>
        </FollowProvider>
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </NotificationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
