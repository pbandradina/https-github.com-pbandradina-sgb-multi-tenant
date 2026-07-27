import React, { useState } from "react";
import { 
  Users, Search, Plus, Trash2, Edit, Phone, Award, 
  MapPin, Check, UserPlus, X, Shield, Star 
} from "lucide-react";
import { Bombeiro, Quartel } from "../types";
import { POSTOS_GRADUACOES, filterBombeiros, getEquipeCadastro } from "../lib/efetivo";
import { formatDate } from "../lib/dates";

interface EfetivoManagerProps {
  selectedQuartelId: string;
  quarteis: Quartel[];
  bombeiros: Bombeiro[];
  onAddBombeiro: (data: Omit<Bombeiro, "id">) => Promise<void>;
  onDeleteBombeiro: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function EfetivoManager({
  selectedQuartelId,
  quarteis,
  bombeiros,
  onAddBombeiro,
  onDeleteBombeiro,
  isAdmin = false
}: EfetivoManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  // Add Firefighter Form States
  const [formNome, setFormNome] = useState("");
  const [formNomeGuerra, setFormNomeGuerra] = useState("");
  const [formRe, setFormRe] = useState("");
  const [formPostoGrad, setFormPostoGrad] = useState("Soldado");
  const [formStatus, setFormStatus] = useState("Ativo");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEspecialidades, setFormEspecialidades] = useState("");
  const [formDataInicioServico, setFormDataInicioServico] = useState(() => formatDate(new Date()));
  const [formRegime, setFormRegime] = useState("PRONTIDÃO");
  const [formEquipe, setFormEquipe] = useState("VERDE");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Brazilian fire station ranks
  const postosGraduacoes = POSTOS_GRADUACOES;

  const activeQuartel = quarteis.find(q => q.id === selectedQuartelId);

  // Filter firefighters belonging to active station, search query and status filter
  const filteredBombeiros = filterBombeiros(bombeiros, selectedQuartelId, statusFilter, searchTerm);

  const handleAddBombeiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome || !formNomeGuerra || !formRe) return;
    setIsSubmitLoading(true);

    try {
      await onAddBombeiro({
        quartel_id: selectedQuartelId,
        nome: formNome,
        nome_guerra: formNomeGuerra,
        re: formRe,
        posto_grad: formPostoGrad,
        status: formStatus,
        telefone: formTelefone,
        especialidades: formEspecialidades,
        data_inicio_servico: formDataInicioServico || formatDate(new Date()),
        regime: formRegime,
        equipe: getEquipeCadastro(formRegime, formEquipe)
      });

      // Reset form
      setFormNome("");
      setFormNomeGuerra("");
      setFormRe("");
      setFormPostoGrad("Soldado");
      setFormStatus("Ativo");
      setFormTelefone("");
      setFormEspecialidades("");
      setFormDataInicioServico(formatDate(new Date()));
      setFormRegime("PRONTIDÃO");
      setFormEquipe("VERDE");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header card with toggle and search bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="text-red-600 w-7 h-7" />
            Efetivo Militar Ativo
          </h1>
          <p className="text-slate-500 text-sm">
            Cadastro e prontuário operacional dos bombeiros vinculados a este Pelotão ({activeQuartel?.nome}).
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-red-600 text-white hover:bg-red-700 font-extrabold px-4 py-2.5 text-sm rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition no-print"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showAddForm ? "Fechar Cadastro" : "Cadastrar Bombeiro"}
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200/60 text-amber-800 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 no-print">
            <Shield className="w-4 h-4 text-amber-600" />
            <span>Modo de Leitura. Para cadastrar militares, faça login no painel.</span>
          </div>
        )}
      </div>

      {/* Add Firefighter sliding form section */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border-2 border-red-500 p-6 shadow-md transition-all">
          <h2 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus className="text-red-500 w-5 h-5" />
            Inserir Novo Membro na Guarnição
          </h2>

          <form onSubmit={handleAddBombeiro} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input 
                type="text" 
                placeholder="Ex: João da Silva Santos"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome de Guerra</label>
              <input 
                type="text" 
                placeholder="Ex: Sd Silva"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formNomeGuerra}
                onChange={(e) => setFormNomeGuerra(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Registro Estadual (RE)</label>
              <input 
                type="text" 
                placeholder="Ex: 145.201-3"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formRe}
                onChange={(e) => setFormRe(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Patente / Graduação</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formPostoGrad}
                onChange={(e) => setFormPostoGrad(e.target.value)}
              >
                {postosGraduacoes.map((posto, i) => (
                  <option key={i} value={posto}>{posto}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone de Contato</label>
              <input 
                type="text" 
                placeholder="Ex: (18) 99762-1100"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formTelefone}
                onChange={(e) => setFormTelefone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início do Serviço (Admissão)</label>
              <input 
                type="date" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formDataInicioServico}
                onChange={(e) => setFormDataInicioServico(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status de Serviço</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="Ativo">Em Atividade (Pronto)</option>
                <option value="Licença">Em Licença Médica / Especial</option>
                <option value="Férias">Em Gozo de Férias Regulamentar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Regime de Trabalho</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formRegime}
                onChange={(e) => setFormRegime(e.target.value)}
              >
                <option value="PRONTIDÃO">PRONTIDÃO (Operacional 24h)</option>
                <option value="EXPEDIENTE">EXPEDIENTE (Administrativo)</option>
              </select>
            </div>

            {formRegime === "PRONTIDÃO" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prontidão (Equipe / Cor)</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                  value={formEquipe}
                  onChange={(e) => setFormEquipe(e.target.value)}
                >
                  <option value="VERDE">VERDE</option>
                  <option value="AMARELA">AMARELA</option>
                  <option value="AZUL">AZUL</option>
                </select>
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Especialidades e Habilitações (Separadas por Vírgula)</label>
              <input 
                type="text" 
                placeholder="Ex: Condutor de Emergência, Salvamento Aquático, Técnico de Resgate, Tirocinado"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                value={formEspecialidades}
                onChange={(e) => setFormEspecialidades(e.target.value)}
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button 
                type="button" 
                className="px-4 py-2 text-xs font-bold text-slate-500 cursor-pointer"
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSubmitLoading}
                className="bg-red-600 text-white font-extrabold px-6 py-2 rounded-lg text-xs hover:bg-red-700 shadow transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {isSubmitLoading ? "Cadastrando..." : "Confirmar Lançamento"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster list & search bar utilities card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
        
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-4 mb-4">
          
          {/* Status Tabs filters */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full lg:w-auto">
            {["Todos", "Ativo", "Férias", "Licença"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 lg:flex-initial text-xs font-black px-4 py-2 rounded-lg cursor-pointer transition ${statusFilter === st ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-850"}`}
              >
                {st === "Todos" ? "Todos os Cadastros" : st === "Ativo" ? "Prontos (Ativos)" : st}
              </button>
            ))}
          </div>

          {/* Search Inputs */}
          <div className="relative w-full lg:w-96 flex items-center">
            <Search className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Buscar por RE, Nome ou Especialidade..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-550"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")} 
                className="absolute right-3 text-xs font-bold text-slate-405 hover:text-slate-600 bg-slate-200 rounded-full w-4 h-4 inline-flex items-center justify-center leading-none"
              >
                X
              </button>
            )}
          </div>
        </div>

        {/* firefighters grid of cards */}
        {filteredBombeiros.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-350 mb-3" />
            <p className="text-md font-bold">Nenhum bombeiro encontrado</p>
            <p className="text-xs text-slate-400">Tente afrouxar os critérios de filtragem ou cadastre novos bombeiros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBombeiros.map((bombeiro) => {
              // Status Styling
              let statusText = "De Prontidão";
              let statusBg = "bg-emerald-55 text-emerald-700 bg-emerald-50 border-emerald-100";
              if (bombeiro.status === "Férias") {
                statusText = "Férias Regulamentares";
                statusBg = "bg-blue-50 text-blue-700 border-blue-105 border-blue-100";
              } else if (bombeiro.status === "Licença") {
                statusText = "Afastado / Licença";
                statusBg = "bg-amber-50 text-amber-700 border-amber-100";
              }

              // Fire soldier star indicator
              const isOfficer = ["Capitão", "1º Tenente", "2º Tenente", "Subtenente"].includes(bombeiro.posto_grad);

              return (
                <div 
                  key={bombeiro.id} 
                  className="border border-slate-100 rounded-2xl p-5 hover:shadow-md transition relative group bg-white hover:border-red-100"
                >
                  {/* Delete action button */}
                  {isAdmin && (
                    <button 
                      onClick={() => onDeleteBombeiro(bombeiro.id)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title={`Excluir cadastro de ${bombeiro.nome_guerra}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="flex gap-4 items-start">
                    <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-extrabold text-xs text-white border-2 border-red-500 uppercase ${isOfficer ? "bg-slate-900" : "bg-red-600"}`}>
                      {isOfficer ? <Star className="w-3 h-3 text-amber-400 fill-amber-400 mb-0.5" /> : null}
                      <span className="text-[10px] leading-tight">{bombeiro.posto_grad.slice(0, 3)}</span>
                    </div>

                    <div className="space-y-1 w-[calc(100%-3.5rem)]">
                      <div className="font-extrabold text-slate-900 leading-tight">
                        {bombeiro.nome_guerra}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-none flex gap-1 font-mono items-center">
                        <Shield className="w-2.5 h-2.5" /> RE {bombeiro.re}
                      </div>
                      <div className="text-[11px] text-slate-600 italic font-medium leading-tight">
                        {bombeiro.nome}
                      </div>
                    </div>
                  </div>

                  {/* Body particulars */}
                  <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                    {/* Início de Serviço */}
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono leading-none">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span>Inc. Serviço: {bombeiro.data_inicio_servico ? new Date(bombeiro.data_inicio_servico + "T00:00:00").toLocaleDateString("pt-BR") : "Não preenchido"}</span>
                    </div>

                    {/* Telephone */}
                    {bombeiro.telefone && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{bombeiro.telefone}</span>
                      </div>
                    )}

                    {/* Specialties listed */}
                    {bombeiro.especialidades && (
                      <div className="flex items-start gap-2">
                        <Award className="w-3.5 h-3.5 text-red-500 mt-1 min-w-[14px]" />
                        <div className="flex flex-wrap gap-1">
                          {bombeiro.especialidades.split(",").map((esp, idx) => (
                            <span key={idx} className="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {esp.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badge Row footer */}
                  <div className="mt-4 pt-3 border-t border-slate-50 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${statusBg}`}>
                        {statusText}
                      </span>
                      <span className="text-[9px] text-slate-350 font-bold font-mono">ID: {bombeiro.id.slice(0, 5)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {bombeiro.regime || "PRONTIDÃO"}
                      </span>
                      {(bombeiro.regime || "PRONTIDÃO") === "PRONTIDÃO" && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${
                          bombeiro.equipe === "VERDE" ? "bg-emerald-600" :
                          bombeiro.equipe === "AMARELA" ? "bg-amber-500 text-slate-900" :
                          "bg-blue-600"
                        }`}>
                          {bombeiro.equipe || "VERDE"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
