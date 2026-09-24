import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { navigation, extraRoutes } from "./app/navigation";
import { Shell } from "./app/shell";
import { ToastProvider } from "./shared/toast";
import "./styles.css";

const rootRoute = createRootRoute({ component: Shell });
const paths = [...navigation.flatMap((group) => group.items.map((item) => item.href)), ...extraRoutes];
const routes = paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path, component: () => null }));
const router = createRouter({ routeTree: rootRoute.addChildren(routes), defaultPreload: "intent" });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><ToastProvider>
  <RouterProvider router={router} />
</ToastProvider></QueryClientProvider></React.StrictMode>);
