import { Route, Routes } from "react-router-dom";
import { AppProvider } from "@/store";
import { Layout } from "@/components/layout/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { ClientesPage } from "@/pages/Clientes";
import { ClienteDetailPage } from "@/pages/ClienteDetail";
import { InvestidoresPage } from "@/pages/Investidores";
import { ProjetosPage } from "@/pages/Projetos";
import { ProjetoDetailPage } from "@/pages/ProjetoDetail";
import { ProdutosPage } from "@/pages/Produtos";
import { FinanceiroPage } from "@/pages/Financeiro";
import { AuditoriaPage } from "@/pages/Auditoria";
import { HandoffPage } from "@/pages/Handoff";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Rota pública: link compartilhável com o time comercial para fazer
            handoff de novos clientes/projetos sem precisar de login. */}
        <Route path="/handoff" element={<HandoffPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projetos" element={<ProjetosPage />} />
          <Route path="projetos/:id" element={<ProjetoDetailPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteDetailPage />} />
          <Route path="investidores" element={<InvestidoresPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="financeiro" element={<FinanceiroPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
