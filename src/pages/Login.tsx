import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Modo = "entrar" | "criar" | "esqueci";

export function LoginPage() {
  const { sessao, login, signUp, resetPassword } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  if (sessao && new Date(sessao.expira_em) > new Date()) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    if (modo === "entrar") {
      const res = await login(email, senha);
      setLoading(false);
      if (!res.ok) {
        setErro(res.erro ?? "Falha ao entrar.");
        return;
      }
      navigate(from, { replace: true });
      return;
    }

    if (modo === "criar") {
      if (senha.length < 8) {
        setLoading(false);
        setErro("A senha deve ter ao menos 8 caracteres.");
        return;
      }
      const res = await signUp(email, senha, nome);
      setLoading(false);
      if (!res.ok) {
        setErro(res.erro ?? "Falha ao criar conta.");
        return;
      }
      setSucesso(
        "Conta criada! Confira sua caixa de entrada para confirmar o e-mail antes de entrar."
      );
      setModo("entrar");
      return;
    }

    if (modo === "esqueci") {
      const res = await resetPassword(email);
      setLoading(false);
      if (!res.ok) {
        setErro(res.erro ?? "Falha ao enviar e-mail.");
        return;
      }
      setSucesso(
        "Enviamos um link de recuperação. Confira sua caixa de entrada."
      );
      setModo("entrar");
      return;
    }
  }

  const titulo =
    modo === "entrar"
      ? "Entrar na plataforma"
      : modo === "criar"
      ? "Criar conta"
      : "Recuperar senha";

  const subtitulo =
    modo === "entrar"
      ? "Acesso restrito a e-mails @v4company.com."
      : modo === "criar"
      ? "Apenas e-mails @v4company.com. Você receberá um link para confirmar."
      : "Digite seu e-mail @v4company.com para receber o link de recuperação.";

  return (
    <div className="flex min-h-screen w-full">
      {/* Hero lateral */}
      <aside className="sidebar-shell relative hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-extrabold">
              V4
            </div>
            <span className="text-lg font-semibold text-white">Gestão de Projetos</span>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <p className="text-3xl font-semibold leading-snug text-white">
            Carteira inteira em um lugar só:
            <br />
            projetos, squad e caixa.
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Visualize seus projetos no kanban, acompanhe a saúde da carteira
            e tenha previsibilidade do fluxo de caixa da unidade.
          </p>
        </div>
        <div className="relative z-10 text-xs text-white/50">
          V4 Company · Unidade de Marketing
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-extrabold">
              V4
            </div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Projetos</h1>
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {titulo}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitulo}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {modo === "criar" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  type="text"
                  autoComplete="name"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como aparece nas reuniões"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@v4company.com"
              />
            </div>

            {modo !== "esqueci" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  {modo === "entrar" && (
                    <button
                      type="button"
                      onClick={() => {
                        setModo("esqueci");
                        setErro(null);
                        setSucesso(null);
                      }}
                      className="text-xs font-medium text-muted-foreground hover:text-primary"
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete={modo === "criar" ? "new-password" : "current-password"}
                    required
                    minLength={modo === "criar" ? 8 : undefined}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder={modo === "criar" ? "Mínimo 8 caracteres" : "••••••••"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {erro && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{sucesso}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {modo === "entrar"
                ? "Entrar"
                : modo === "criar"
                ? "Criar conta"
                : "Enviar link"}
            </Button>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              {modo === "entrar" && (
                <>
                  Primeira vez?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setModo("criar");
                      setErro(null);
                      setSucesso(null);
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Criar conta
                  </button>
                </>
              )}
              {modo === "criar" && (
                <>
                  Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setModo("entrar");
                      setErro(null);
                      setSucesso(null);
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Entrar
                  </button>
                </>
              )}
              {modo === "esqueci" && (
                <button
                  type="button"
                  onClick={() => {
                    setModo("entrar");
                    setErro(null);
                    setSucesso(null);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Voltar para o login
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
