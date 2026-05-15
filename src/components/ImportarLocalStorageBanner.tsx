import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApp } from "@/store";
import { readKey, STORAGE_KEYS } from "@/store/storage";

// Banner mostrado UMA VEZ: quando o usuário tem dados antigos no
// localStorage mas o Supabase está vazio (típico do primeiro login após
// a migração). Oferece importação one-shot.
export function ImportarLocalStorageBanner() {
  const { clientes, projetos, importarLocalStorage } = useApp();
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{
    detalhes: Record<string, number>;
    erro?: string;
  } | null>(null);
  const [dispensado, setDispensado] = useState(false);

  const temDadosLocais = useMemo(() => {
    const lsClientes = readKey<unknown[]>(STORAGE_KEYS.clientes, []);
    const lsProjetos = readKey<unknown[]>(STORAGE_KEYS.projetos, []);
    return lsClientes.length > 0 || lsProjetos.length > 0;
  }, []);

  const supabaseVazio = clientes.length === 0 && projetos.length === 0;

  if (dispensado || !temDadosLocais || !supabaseVazio || resultado?.detalhes) {
    return null;
  }

  async function importar() {
    setImportando(true);
    const res = await importarLocalStorage();
    setImportando(false);
    setResultado({ detalhes: res.detalhes, erro: res.erro });
  }

  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-200 text-amber-800">
            <Upload className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-amber-900">
              Dados locais detectados
            </p>
            <p className="text-xs text-amber-800">
              Encontramos dados desta máquina (clientes, projetos, investidores
              etc.) que ainda não estão na nuvem. Quer importar pro Supabase?
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDispensado(true)}
            disabled={importando}
            title="Dispensar (não importar)"
          >
            <X className="h-3.5 w-3.5" />
            Agora não
          </Button>
          <Button size="sm" onClick={importar} disabled={importando}>
            {importando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Importar para o Supabase
          </Button>
        </div>
      </CardContent>

      {resultado && (
        <CardContent className="border-t border-amber-200 p-4">
          {resultado.erro ? (
            <p className="text-sm text-destructive">
              Erro: {resultado.erro}
            </p>
          ) : (
            <div className="flex items-start gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Importação concluída!</p>
                <p className="text-xs">
                  {Object.entries(resultado.detalhes)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k}`)
                    .join(" · ") || "Nenhum item para importar."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
