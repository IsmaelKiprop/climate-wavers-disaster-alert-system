import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { NotificationProvider } from "./context/NotificationContext";
import { ChatProvider } from "./context/ChatContext";
import { FollowProvider } from "./context/FollowContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ConnectivityProvider } from "./context/ConnectivityContext";
import { registerServiceWorker } from "./utils/registerSW";
import "./styles/font.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
      retry: 1,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConnectivityProvider>
          <NotificationProvider>
            <ChatProvider>
              <FollowProvider>
                <SidebarProvider>
                  <App />
                </SidebarProvider>
              </FollowProvider>
            </ChatProvider>
          </NotificationProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
