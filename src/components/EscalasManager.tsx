import React, { useState } from "react";
import { 
  Calendar, Printer, Plus, Trash2, Shield, User, Clock, 
  MapPin, CheckCircle, FileText, ChevronDown, Download 
} from "lucide-react";
import { Bombeiro, Escala, Quartel, Afastamento, Fmo } from "../types";
import { formatDateBR, todayKey } from "../lib/dates";
import { FUNCOES_ESCALA, PERIODOS_ESCALA } from "../lib/escalas";
import { findAfastamentoNaData, findFmoNaData } from "../lib/frequencia";

interface EscalasManagerProps {
  selectedQuartelId: string;
  quarteis: Quartel[];
  bombeiros: Bombeiro[];
  escalas: Escala[];
  onAddEscala: (data: Omit<Escala, "id">) => Promise<void>;
  onDeleteEscala: (id: string) => Promise<void>;
  afastamentos?: Afastamento[];
  fmos?: Fmo[];
  isAdmin?: boolean;
}

export default function EscalasManager({
  selectedQuartelId,
  quarteis,
  bombeiros,
  escalas,
  onAddEscala,
  onDeleteEscala,
  afastamentos = [],
  fmos = [],
  isAdmin = false
}: EscalasManagerProps) {
  const [formDate, setFormDate] = useState(todayKey());
  const [formBombeiroId, setFormBombeiroId] = useState("");
  const [formFuncao, setFormFuncao] = useState("Auxiliar de Linha (Combate)");
  const [formPeriodo, setFormPeriodo] = useState("24h");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Filter for search or list
  const [filterDate, setFilterDate] = useState("");

  const activeQuartel = quarteis.find(q => q.id === selectedQuartelId);
  const activeBombeiros = bombeiros.filter(b => b.quartel_id === selectedQuartelId);

  // Filter scales for the active department
  const activeEscalas = escalas.filter(
    e => e.quartel_id === selectedQuartelId && (!filterDate || e.data === filterDate)
  );

  const handleAddEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBombeiroId) return;

    // 1. Verificar se o militar está afastado na data escolhida
    const targetAfastamento = findAfastamentoNaData(afastamentos, formBombeiroId, formDate);

    const militarObj = bombeiros.find(b => b.id === formBombeiroId);

    if (targetAfastamento) {
      const proce = confirm(
        `ALERTA DE SEGURANÇA OPERACIONAL:\nO militar ${militarObj?.nome_guerra} está cadastrado como afastado por [${targetAfastamento.tipo}] de ${targetAfastamento.data_inicio} a ${targetAfastamento.data_fim}.\n\nDeseja ignorar o afastamento e forçar a escala fiscal para o dia ${formDate} mesmo assim?`
      );
      if (!proce) return;
    }

    // 2. Verificar se o militar possui FMO na data da escala
    const targetFmo = findFmoNaData(fmos, formBombeiroId, formDate);
    if (targetFmo) {
      const proce = confirm(
        `CONFLITO COM FMO (Folga Mensal Obrigatória):\nO dia ${formDate} é reservado para a Folga Obrigatória (FMO) do militar ${militarObj?.nome_guerra}.\n\nDeseja anular a folga em escala e forçar o serviço operacional dele neste dia?`
      );
      if (!proce) return;
    }

    // 3. Verificar início do serviço ativo (Data de Admissão)
    if (militarObj && militarObj.data_inicio_servico) {
      if (formDate < militarObj.data_inicio_servico) {
        const formattedDate = formatDateBR(militarObj.data_inicio_servico);
        alert(
          `ERRO DE COERÊNCIA CRONOLÓGICA:\nO militar ${militarObj.nome_guerra} iniciou o serviço ativo em ${formattedDate}.\n\nNão é permitido escalar serviços ou plantões para datas anteriores à data de início do serviço.`
        );
        return;
      }
    }

    setIsSubmitLoading(true);

    try {
      await onAddEscala({
        quartel_id: selectedQuartelId,
        data: formDate,
        bombeiro_id: formBombeiroId,
        funcao: formFuncao,
        periodo: formPeriodo
      });
      // Clear or reset select
      setFormBombeiroId("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Group scales by date for the PDF roster preview
  const groupedEscalasByDate = activeEscalas.reduce((groups: Record<string, Escala[]>, escala) => {
    const key = escala.data;
    if (!groups[key]) groups[key] = [];
    groups[key].push(escala);
    return groups;
  }, {});

  const datesWithEscalas = Object.keys(groupedEscalasByDate).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="text-red-600 w-7 h-7" />
            Gestor de Escalas Físicas
          </h1>
          <p className="text-slate-500 text-sm">
            Adicione guarnições ao plantão diário e gere o boletim oficial para impressão física.
          </p>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-slate-905 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 text-sm font-extrabold rounded-xl flex items-center gap-2 shadow-md cursor-pointer no-print transition"
        >
          <Printer className="w-4 h-4" /> Imprimir Escala Ativa
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Planner Input Column */}
        <div className="xl:col-span-1 space-y-6 no-print">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h2 className="text-md font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Planejar Novo Plantonista
            </h2>

            {isAdmin ? (
              <form onSubmit={handleAddEscala} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Serviço</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bombeiro Prontificado</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                  value={formBombeiroId}
                  onChange={(e) => setFormBombeiroId(e.target.value)}
                  required
                >
                  <option value="">-- Selecione do Efetivo Militar --</option>
                  {activeBombeiros.map(b => {
                    const isAfastado = findAfastamentoNaData(afastamentos, b.id, formDate);
                    const hasFmo = findFmoNaData(fmos, b.id, formDate);
                    
                    let suffix = "";
                    if (isAfastado) suffix = ` - [🏥 AFASTADO: ${isAfastado.tipo.toUpperCase()}]`;
                    else if (hasFmo) suffix = " - [💤 DIA DE FMO]";
                    else if (b.status !== "Ativo") suffix = ` - [(${b.status})]`;

                    return (
                      <option key={b.id} value={b.id}>
                        {b.posto_grad} {b.nome_guerra} ({b.re}){suffix}
                      </option>
                    );
                  })}
                </select>
                {activeBombeiros.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">Nenhum bombeiro ativo cadastrado para este quartel.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Função / Posto de Serviço</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-red-500"
                  value={formFuncao}
                  onChange={(e) => setFormFuncao(e.target.value)}
                >
                  {FUNCOES_ESCALA.map((func, i) => (
                    <option key={i} value={func}>{func}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período de Serviço</label>
                <div className="grid grid-cols-3 gap-2">
                  {PERIODOS_ESCALA.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`py-1.5 rounded-lg text-xs font-extrabold cursor-pointer border ${formPeriodo === p ? "bg-red-550 bg-red-650 bg-red-600 text-white border-red-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                      onClick={() => setFormPeriodo(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitLoading || !formBombeiroId}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-2.5 rounded-xl text-sm shadow-md cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Escalpar Integrante
              </button>
            </form>
            ) : (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs text-amber-800 font-semibold space-y-2 flex flex-col items-center">
                <Shield className="w-8 h-8 text-amber-600 mb-1" />
                <span className="text-center leading-relaxed">Você está em Modo de Leitura. Acesse a conta de administrador no painel superior para planejar novos plantonistas.</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Instruções de Impressão</h3>
            <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
              <li>Use o botão <b>Imprimir Escala</b> no canto superior pra mandar diretamente à impressora ou salvar como PDF no seu computador.</li>
              <li>A folha gerada segue estritamente o layout padrão da Força Auxiliar SP.</li>
              <li>Sempre use as margens padrão do navegador em "Padrão" após clicar em Imprimir.</li>
            </ul>
          </div>
        </div>

        {/* Scales & Output Columns */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* List View with filter */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 no-print">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-md font-bold text-slate-800">
                  Escalas Planejadas no Quartel
                </h2>
                <p className="text-xs text-slate-500">Filtragem e registros armazenados</p>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-400 font-semibold">Data:</span>
                <input 
                  type="date"
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate("")} 
                    className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5 py-0.5 cursor-pointer hover:bg-slate-350"
                  >
                    X
                  </button>
                )}
              </div>
            </div>

            {activeEscalas.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto text-slate-350 mb-2" />
                <p className="text-sm font-semibold">Nenhuma escala ativa correspondente</p>
                <p className="text-xs text-slate-400">Verifique a data filtrada ou preencha o planejador esquerdo.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {activeEscalas.map((escala) => {
                  const bombeiro = bombeiros.find(b => b.id === escala.bombeiro_id);
                  return (
                    <div 
                      key={escala.id} 
                      className="p-3 border border-slate-100 bg-slate-50 hover:bg-slate-100/50 rounded-xl flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs text-slate-400 bg-white border border-slate-100 px-2.5 py-1.5 rounded-lg text-center leading-none">
                          <span className="block font-bold text-slate-700">{escala.data.split("-")[2]}</span>
                          <span className="text-[8px] uppercase">{formatDateBR(escala.data, { month: "short" })}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-xs">
                            {bombeiro ? `${bombeiro.posto_grad} ${bombeiro.nome_guerra}` : "Bombeiro Desconhecido"}
                          </div>
                          <div className="text-[10px] text-red-600 font-bold uppercase">{escala.funcao}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold font-mono">
                          {escala.periodo}
                        </span>
                        {isAdmin && (
                          <button 
                            onClick={() => onDeleteEscala(escala.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 rounded hover:bg-white cursor-pointer transition"
                            title="Deletar escala"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Premium Preview of "Boletim de Operações Oficial" */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 shadow-lg p-8 print-card relative">
            
            {/* Stamp Header */}
            <div className="border-b-2 border-slate-950 pb-4 text-center space-y-1">
              <div className="flex justify-center items-center gap-2 mb-1.5">
                <Shield className="w-8 h-8 text-slate-900 stroke-[1.5]" />
              </div>
              <h3 className="text-xs font-black tracking-widest text-slate-900 uppercase">
                GOVERNO DO ESTADO DE SÃO PAULO
              </h3>
              <h4 className="text-[10px] font-bold tracking-wider text-slate-700 uppercase">
                SECRETARIA DE ESTADO DOS NEGÓCIOS DA SEGURANÇA PÚBLICA
              </h4>
              <h5 className="text-[10px] font-extrabold text-slate-800 uppercase">
                CORPO DE BOMBEIROS DA PMESP — {activeQuartel?.nome.toUpperCase() || "SEDE"}
              </h5>
              <div className="text-[9px] font-mono text-slate-500 italic">
                SGB Multi-Tenant v1.1 • Escala Eletrônica de Prontidão
              </div>
            </div>

            {/* Document Title bar */}
            <div className="my-6 text-center">
              <h2 className="text-md font-black tracking-tight text-slate-900 uppercase">
                ESCALA DE SERVIÇO INTERNO E OPERACIONAL
              </h2>
              <div className="text-xs text-slate-700 font-semibold font-mono mt-0.5">
                Vigência Operacional: {filterDate ? formatDateBR(filterDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Todas as Datas Lançadas"}
              </div>
            </div>

            {/* Print Body */}
            <div className="space-y-6">
              {datesWithEscalas.length === 0 ? (
                <div className="text-center py-10 text-xs italic text-slate-400">
                  Sem dados para exibição nas datas filtradas. Lance integrantes no plantão para povoar a folha de impressão militar.
                </div>
              ) : (
                datesWithEscalas.map((dataKey) => {
                  const items = groupedEscalasByDate[dataKey];
                  return (
                    <div key={dataKey} className="space-y-2">
                      <div className="text-[11px] font-extrabold text-slate-900 border-b border-slate-300 pb-1 flex justify-between">
                        <span>DATA OPERACIONAL DE ATIVIDADE: {formatDateBR(dataKey)}</span>
                        <span className="font-mono text-[9px]">QTDE: {items.length} HOMENS</span>
                      </div>

                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-400 bg-slate-50">
                            <th className="py-2 px-1 font-black text-slate-800 text-[10px] uppercase w-1/4">Posto / Função</th>
                            <th className="py-2 px-1 font-black text-slate-800 text-[10px] uppercase w-5/12">Nome de Guerra</th>
                            <th className="py-2 px-1 font-black text-slate-800 text-[10px] uppercase w-2/12">RE Militar</th>
                            <th className="py-2 px-1 font-black text-slate-800 text-[10px] uppercase w-1/2">Turno</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((e) => {
                            const b = bombeiros.find(bm => bm.id === e.bombeiro_id);
                            return (
                              <tr key={e.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                                <td className="py-1.5 px-1 font-bold text-slate-900 text-[10.5px]">{e.funcao}</td>
                                <td className="py-1.5 px-1 text-slate-700 text-[10.5px]">
                                  {b ? `${b.posto_grad} ${b.nome_guerra}` : "NI"}
                                </td>
                                <td className="py-1.5 px-1 font-mono text-slate-600 text-[10.5px]">{b?.re || "000.000-0"}</td>
                                <td className="py-1.5 px-1 font-mono font-bold text-slate-700 text-[10px] uppercase">{e.periodo}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>

            {/* Signature Block */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[10px]">
              <div className="space-y-4">
                <div className="h-8 border-b border-slate-400/50"></div>
                <div>
                  <div className="font-black text-slate-805 text-slate-800">SGT PM AUXILIAR DA SGB</div>
                  <div className="text-slate-500 font-mono text-[9px]">Setor de Escalas Corporativas</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-8 border-b border-slate-400/50"></div>
                <div>
                  <div className="font-black text-slate-805 text-slate-800">CAP PM COMANDANTE DA UNIDADE</div>
                  <div className="text-slate-500 font-mono text-[9px]">SGB-Andradina SP Homologado</div>
                </div>
              </div>
            </div>

            {/* Document Stamp Footer */}
            <div className="mt-8 text-center text-[8px] text-slate-400 font-mono">
              ESTE DOCUMENTO ATENDE ÀS DISPOSIÇÕES DA RESOLUÇÃO DA SSP DO ESTADO DE SÃO PAULO E FOI SINCRONIZADO COM O BANCO DE DADOS SUPABASE POSTGRESQL.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
