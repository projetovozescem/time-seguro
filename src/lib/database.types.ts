// GERADO por scripts/db-tipos.mjs a partir do schema do projeto de
// desenvolvimento. NAO EDITAR A MAO: rode `npm run db:tipos` depois de
// aplicar qualquer migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acessos_pin: {
        Row: {
          acao: string
          colaborador_id: string
          criado_em: string
          empresa_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          colaborador_id: string
          criado_em?: string
          empresa_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          colaborador_id?: string
          criado_em?: string
          empresa_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acessos_pin_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessos_pin_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_diaria: {
        Row: {
          campanha_id: string
          colaborador_id: string
          dia: string
          empresa_id: string
        }
        Insert: {
          campanha_id: string
          colaborador_id: string
          dia: string
          empresa_id: string
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string
          dia?: string
          empresa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividade_diaria_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_diaria_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "atividade_diaria_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_diaria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanha_resultados: {
        Row: {
          campanha_id: string
          colaborador_id: string | null
          detalhes: Json
          empresa_id: string
          id: string
          pontos: number
          posicao: number
          setor_id: string | null
          tipo: string
        }
        Insert: {
          campanha_id: string
          colaborador_id?: string | null
          detalhes?: Json
          empresa_id: string
          id?: string
          pontos: number
          posicao: number
          setor_id?: string | null
          tipo: string
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string | null
          detalhes?: Json
          empresa_id?: string
          id?: string
          pontos?: number
          posicao?: number
          setor_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_resultados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_resultados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "campanha_resultados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_resultados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_resultados_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_resultados_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      campanha_temas: {
        Row: {
          campanha_id: string
          empresa_id: string
          tema_id: string
        }
        Insert: {
          campanha_id: string
          empresa_id: string
          tema_id: string
        }
        Update: {
          campanha_id?: string
          empresa_id?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_temas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_temas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "campanha_temas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_temas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          config: Json
          criado_em: string
          descricao: string | null
          empresa_id: string
          encerrada_em: string | null
          fim: string
          id: string
          inicio: string
          nome: string
          perguntas_por_dia: number
          premiacao: string | null
          ranking_visivel: boolean
          status: string
        }
        Insert: {
          config?: Json
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          encerrada_em?: string | null
          fim: string
          id?: string
          inicio: string
          nome: string
          perguntas_por_dia?: number
          premiacao?: string | null
          ranking_visivel?: boolean
          status?: string
        }
        Update: {
          config?: Json
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          encerrada_em?: string | null
          fim?: string
          id?: string
          inicio?: string
          nome?: string
          perguntas_por_dia?: number
          premiacao?: string | null
          ranking_visivel?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          campanha_id: string
          carga_minutos: number | null
          codigo: string
          colaborador_id: string | null
          dados: Json
          emitido_em: string
          empresa_id: string
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          campanha_id: string
          carga_minutos?: number | null
          codigo: string
          colaborador_id?: string | null
          dados?: Json
          emitido_em?: string
          empresa_id: string
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          campanha_id?: string
          carga_minutos?: number | null
          codigo?: string
          colaborador_id?: string | null
          dados?: Json
          emitido_em?: string
          empresa_id?: string
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "certificados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          colaborador_id: string
          criado_em: string
          empresa_id: string
          evento_id: string
          id: string
        }
        Insert: {
          colaborador_id: string
          criado_em?: string
          empresa_id: string
          evento_id: string
          id?: string
        }
        Update: {
          colaborador_id?: string
          criado_em?: string
          empresa_id?: string
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          anonimizado: boolean
          ativo: boolean
          bloqueado_ate: string | null
          criado_em: string
          email: string | null
          empresa_id: string
          id: string
          lgpd_aceite_em: string | null
          lgpd_aceite_versao: number | null
          matricula: string
          nome: string
          pin_fixo: string | null
          pin_hash: string | null
          pin_provisorio: boolean
          setor_id: string | null
          tentativas_falhas: number
          turno: string | null
        }
        Insert: {
          anonimizado?: boolean
          ativo?: boolean
          bloqueado_ate?: string | null
          criado_em?: string
          email?: string | null
          empresa_id: string
          id?: string
          lgpd_aceite_em?: string | null
          lgpd_aceite_versao?: number | null
          matricula: string
          nome: string
          pin_fixo?: string | null
          pin_hash?: string | null
          pin_provisorio?: boolean
          setor_id?: string | null
          tentativas_falhas?: number
          turno?: string | null
        }
        Update: {
          anonimizado?: boolean
          ativo?: boolean
          bloqueado_ate?: string | null
          criado_em?: string
          email?: string | null
          empresa_id?: string
          id?: string
          lgpd_aceite_em?: string | null
          lgpd_aceite_versao?: number | null
          matricula?: string
          nome?: string
          pin_fixo?: string | null
          pin_hash?: string | null
          pin_provisorio?: boolean
          setor_id?: string | null
          tentativas_falhas?: number
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      consentimentos_lgpd: {
        Row: {
          aceito_em: string
          colaborador_id: string
          empresa_id: string
          id: string
          versao: number
        }
        Insert: {
          aceito_em?: string
          colaborador_id: string
          empresa_id: string
          id?: string
          versao: number
        }
        Update: {
          aceito_em?: string
          colaborador_id?: string
          empresa_id?: string
          id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "consentimentos_lgpd_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimentos_lgpd_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      denuncia_mensagens: {
        Row: {
          autor: string
          denuncia_id: string
          empresa_id: string
          enviada_em: string
          id: string
          mensagem: string
          ordem: number
        }
        Insert: {
          autor: string
          denuncia_id: string
          empresa_id: string
          enviada_em?: string
          id?: string
          mensagem: string
          ordem?: never
        }
        Update: {
          autor?: string
          denuncia_id?: string
          empresa_id?: string
          enviada_em?: string
          id?: string
          mensagem?: string
          ordem?: never
        }
        Relationships: [
          {
            foreignKeyName: "denuncia_mensagens_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias_assedio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denuncia_mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      denuncias_assedio: {
        Row: {
          categoria: string
          descricao: string
          empresa_id: string
          id: string
          local_aproximado: string | null
          periodo_aproximado: string | null
          protocolo: string
          quer_retorno: boolean
          recebida_em: string
          senha_hash: string
          status: string
        }
        Insert: {
          categoria: string
          descricao: string
          empresa_id: string
          id?: string
          local_aproximado?: string | null
          periodo_aproximado?: string | null
          protocolo: string
          quer_retorno?: boolean
          recebida_em?: string
          senha_hash: string
          status?: string
        }
        Update: {
          categoria?: string
          descricao?: string
          empresa_id?: string
          id?: string
          local_aproximado?: string | null
          periodo_aproximado?: string | null
          protocolo?: string
          quer_retorno?: boolean
          recebida_em?: string
          senha_hash?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_assedio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          codigo: string
          config: Json
          criado_em: string
          id: string
          logo_url: string | null
          nome: string
          termo_lgpd_texto: string
          termo_lgpd_versao: number
        }
        Insert: {
          codigo: string
          config?: Json
          criado_em?: string
          id?: string
          logo_url?: string | null
          nome: string
          termo_lgpd_texto?: string
          termo_lgpd_versao?: number
        }
        Update: {
          codigo?: string
          config?: Json
          criado_em?: string
          id?: string
          logo_url?: string | null
          nome?: string
          termo_lgpd_texto?: string
          termo_lgpd_versao?: number
        }
        Relationships: []
      }
      eventos: {
        Row: {
          campanha_id: string | null
          codigo_anterior: string | null
          codigo_atualizado_em: string | null
          codigo_checkin: string | null
          criado_em: string
          descricao: string | null
          empresa_id: string
          fim: string
          id: string
          inicio: string
          pontos: number
          setor_id: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          campanha_id?: string | null
          codigo_anterior?: string | null
          codigo_atualizado_em?: string | null
          codigo_checkin?: string | null
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          fim: string
          id?: string
          inicio: string
          pontos?: number
          setor_id?: string | null
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          campanha_id?: string | null
          codigo_anterior?: string | null
          codigo_atualizado_em?: string | null
          codigo_checkin?: string | null
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          fim?: string
          id?: string
          inicio?: string
          pontos?: number
          setor_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      licao_perguntas: {
        Row: {
          empresa_id: string
          licao_id: string
          ordem: number
          pergunta_id: string
        }
        Insert: {
          empresa_id: string
          licao_id: string
          ordem?: number
          pergunta_id: string
        }
        Update: {
          empresa_id?: string
          licao_id?: string
          ordem?: number
          pergunta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licao_perguntas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licao_perguntas_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "licoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licao_perguntas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      licoes: {
        Row: {
          campanha_id: string
          carga_minutos: number
          conteudo_md: string
          criado_em: string
          empresa_id: string
          id: string
          nota_minima: number
          obrigatoria: boolean
          ordem: number
          publicada: boolean
          tema_id: string | null
          titulo: string
          video_url: string | null
        }
        Insert: {
          campanha_id: string
          carga_minutos?: number
          conteudo_md?: string
          criado_em?: string
          empresa_id: string
          id?: string
          nota_minima?: number
          obrigatoria?: boolean
          ordem?: number
          publicada?: boolean
          tema_id?: string | null
          titulo: string
          video_url?: string | null
        }
        Update: {
          campanha_id?: string
          carga_minutos?: number
          conteudo_md?: string
          criado_em?: string
          empresa_id?: string
          id?: string
          nota_minima?: number
          obrigatoria?: boolean
          ordem?: number
          publicada?: boolean
          tema_id?: string | null
          titulo?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "licoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licoes_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          setor_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          setor_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locais_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locais_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      perfis_tecnicos: {
        Row: {
          comite_assedio: boolean
          criado_em: string
          empresa_id: string
          nome: string
          papel: string
          user_id: string
        }
        Insert: {
          comite_assedio?: boolean
          criado_em?: string
          empresa_id: string
          nome: string
          papel?: string
          user_id: string
        }
        Update: {
          comite_assedio?: boolean
          criado_em?: string
          empresa_id?: string
          nome?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_tecnicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perguntas: {
        Row: {
          alternativas: string[]
          correta: number
          criado_em: string
          dificuldade: number
          empresa_id: string | null
          enunciado: string
          explicacao: string | null
          id: string
          origem: string
          status: string
          tema_id: string
        }
        Insert: {
          alternativas: string[]
          correta: number
          criado_em?: string
          dificuldade?: number
          empresa_id?: string | null
          enunciado: string
          explicacao?: string | null
          id?: string
          origem?: string
          status?: string
          tema_id: string
        }
        Update: {
          alternativas?: string[]
          correta?: number
          criado_em?: string
          dificuldade?: number
          empresa_id?: string | null
          enunciado?: string
          explicacao?: string | null
          id?: string
          origem?: string
          status?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perguntas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perguntas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_lancamentos: {
        Row: {
          campanha_id: string
          colaborador_id: string | null
          criado_em: string
          dia: string
          empresa_id: string
          id: string
          origem: string
          origem_id: string
          pilar: string
          pontos: number
          setor_id: string | null
        }
        Insert: {
          campanha_id: string
          colaborador_id?: string | null
          criado_em?: string
          dia: string
          empresa_id: string
          id?: string
          origem: string
          origem_id: string
          pilar: string
          pontos: number
          setor_id?: string | null
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string | null
          criado_em?: string
          dia?: string
          empresa_id?: string
          id?: string
          origem?: string
          origem_id?: string
          pilar?: string
          pontos?: number
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_lancamentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      progresso_licoes: {
        Row: {
          aprovado_em: string | null
          colaborador_id: string
          conteudo_concluido_em: string | null
          empresa_id: string
          id: string
          licao_id: string
          melhor_nota: number | null
          tentativas: number
          tentativas_hoje: number
          ultima_tentativa_dia: string | null
        }
        Insert: {
          aprovado_em?: string | null
          colaborador_id: string
          conteudo_concluido_em?: string | null
          empresa_id: string
          id?: string
          licao_id: string
          melhor_nota?: number | null
          tentativas?: number
          tentativas_hoje?: number
          ultima_tentativa_dia?: string | null
        }
        Update: {
          aprovado_em?: string | null
          colaborador_id?: string
          conteudo_concluido_em?: string | null
          empresa_id?: string
          id?: string
          licao_id?: string
          melhor_nota?: number | null
          tentativas?: number
          tentativas_hoje?: number
          ultima_tentativa_dia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_licoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_licoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_licoes_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "licoes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tv_equipes: {
        Row: {
          acertos: number
          empresa_id: string
          erros: number
          pontos: number
          sessao_id: string
          setor_id: string
        }
        Insert: {
          acertos?: number
          empresa_id: string
          erros?: number
          pontos?: number
          sessao_id: string
          setor_id: string
        }
        Update: {
          acertos?: number
          empresa_id?: string
          erros?: number
          pontos?: number
          sessao_id?: string
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tv_equipes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_equipes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "quiz_tv_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_equipes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_equipes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      quiz_tv_respostas: {
        Row: {
          acertou: boolean
          alternativa: number | null
          empresa_id: string
          id: string
          ordem: number
          pergunta_id: string | null
          sessao_id: string
          setor_id: string | null
          tempo_ms: number
        }
        Insert: {
          acertou: boolean
          alternativa?: number | null
          empresa_id: string
          id?: string
          ordem?: number
          pergunta_id?: string | null
          sessao_id: string
          setor_id?: string | null
          tempo_ms?: number
        }
        Update: {
          acertou?: boolean
          alternativa?: number | null
          empresa_id?: string
          id?: string
          ordem?: number
          pergunta_id?: string | null
          sessao_id?: string
          setor_id?: string | null
          tempo_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tv_respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "quiz_tv_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      quiz_tv_sessoes: {
        Row: {
          campanha_id: string | null
          criado_em: string
          criado_por: string | null
          duracao_ms: number
          empresa_id: string
          evento_id: string | null
          id: string
          modo: string
        }
        Insert: {
          campanha_id?: string | null
          criado_em?: string
          criado_por?: string | null
          duracao_ms?: number
          empresa_id: string
          evento_id?: string | null
          id?: string
          modo: string
        }
        Update: {
          campanha_id?: string | null
          criado_em?: string
          criado_por?: string | null
          duracao_ms?: number
          empresa_id?: string
          evento_id?: string | null
          id?: string
          modo?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tv_sessoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_sessoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "quiz_tv_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_sessoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: true
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      relato_historico: {
        Row: {
          autor_user_id: string | null
          comentario: string | null
          criado_em: string
          empresa_id: string
          id: string
          relato_id: string
          status: string
          visivel_colaborador: boolean
        }
        Insert: {
          autor_user_id?: string | null
          comentario?: string | null
          criado_em?: string
          empresa_id: string
          id?: string
          relato_id: string
          status: string
          visivel_colaborador?: boolean
        }
        Update: {
          autor_user_id?: string | null
          comentario?: string | null
          criado_em?: string
          empresa_id?: string
          id?: string
          relato_id?: string
          status?: string
          visivel_colaborador?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "relato_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relato_historico_relato_id_fkey"
            columns: ["relato_id"]
            isOneToOne: false
            referencedRelation: "relatos"
            referencedColumns: ["id"]
          },
        ]
      }
      relatos: {
        Row: {
          campanha_id: string | null
          categoria: string
          colaborador_id: string | null
          criado_em: string
          descricao: string
          duplicado_de: string | null
          empresa_id: string
          foto_path: string | null
          gravidade: string | null
          id: string
          local_id: string | null
          possivel_duplicado_de: string | null
          setor_id: string | null
          status: string
          validado: boolean
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          campanha_id?: string | null
          categoria: string
          colaborador_id?: string | null
          criado_em?: string
          descricao: string
          duplicado_de?: string | null
          empresa_id: string
          foto_path?: string | null
          gravidade?: string | null
          id?: string
          local_id?: string | null
          possivel_duplicado_de?: string | null
          setor_id?: string | null
          status?: string
          validado?: boolean
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          campanha_id?: string | null
          categoria?: string
          colaborador_id?: string | null
          criado_em?: string
          descricao?: string
          duplicado_de?: string | null
          empresa_id?: string
          foto_path?: string | null
          gravidade?: string | null
          id?: string
          local_id?: string | null
          possivel_duplicado_de?: string | null
          setor_id?: string | null
          status?: string
          validado?: boolean
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "relatos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_duplicado_de_fkey"
            columns: ["duplicado_de"]
            isOneToOne: false
            referencedRelation: "relatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_possivel_duplicado_de_fkey"
            columns: ["possivel_duplicado_de"]
            isOneToOne: false
            referencedRelation: "relatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      respostas: {
        Row: {
          acertou: boolean
          alternativa: number
          campanha_id: string
          colaborador_id: string
          criado_em: string
          dia: string
          empresa_id: string
          id: string
          licao_id: string | null
          origem: string
          pergunta_id: string
          tempo_ms: number
        }
        Insert: {
          acertou: boolean
          alternativa: number
          campanha_id: string
          colaborador_id: string
          criado_em?: string
          dia: string
          empresa_id: string
          id?: string
          licao_id?: string | null
          origem: string
          pergunta_id: string
          tempo_ms?: number
        }
        Update: {
          acertou?: boolean
          alternativa?: number
          campanha_id?: string
          colaborador_id?: string
          criado_em?: string
          dia?: string
          empresa_id?: string
          id?: string
          licao_id?: string | null
          origem?: string
          pergunta_id?: string
          tempo_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "respostas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "licoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      selos: {
        Row: {
          descricao: string
          icone: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          descricao: string
          icone: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      selos_conquistados: {
        Row: {
          campanha_id: string
          colaborador_id: string
          conquistado_em: string
          empresa_id: string
          id: string
          selo_id: string
        }
        Insert: {
          campanha_id: string
          colaborador_id: string
          conquistado_em?: string
          empresa_id: string
          id?: string
          selo_id: string
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string
          conquistado_em?: string
          empresa_id?: string
          id?: string
          selo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selos_conquistados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selos_conquistados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "selos_conquistados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selos_conquistados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selos_conquistados_selo_id_fkey"
            columns: ["selo_id"]
            isOneToOne: false
            referencedRelation: "selos"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_colaborador: {
        Row: {
          colaborador_id: string
          criado_em: string
          expira_em: string
          id: string
          revogada: boolean
          token_hash: string
        }
        Insert: {
          colaborador_id: string
          criado_em?: string
          expira_em: string
          id?: string
          revogada?: boolean
          token_hash: string
        }
        Update: {
          colaborador_id?: string
          criado_em?: string
          expira_em?: string
          id?: string
          revogada?: boolean
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          cor: string
          criado_em: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          criado_em?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          criado_em?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_cadastro: {
        Row: {
          colaborador_id: string | null
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          email: string
          empresa_id: string
          id: string
          matricula: string
          motivo: string | null
          nome: string
          setor_id: string | null
          status: string
        }
        Insert: {
          colaborador_id?: string | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email: string
          empresa_id: string
          id?: string
          matricula: string
          motivo?: string | null
          nome: string
          setor_id?: string | null
          status?: string
        }
        Update: {
          colaborador_id?: string | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email?: string
          empresa_id?: string
          id?: string
          matricula?: string
          motivo?: string | null
          nome?: string
          setor_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_cadastro_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_cadastro_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_cadastro_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_cadastro_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
        ]
      }
      temas: {
        Row: {
          cor: string
          empresa_id: string | null
          icone: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          cor?: string
          empresa_id?: string | null
          icone?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          cor?: string
          empresa_id?: string | null
          icone?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "temas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_desempenho_pergunta: {
        Row: {
          acertos: number | null
          alternativa_errada_mais_comum: number | null
          campanha_id: string | null
          empresa_id: string | null
          enunciado: string | null
          pergunta_id: string | null
          taxa_acerto: number | null
          tema_id: string | null
          tentativas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perguntas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lacunas: {
        Row: {
          acertos: number | null
          campanha_id: string | null
          empresa_id: string | null
          setor_id: string | null
          taxa_acerto: number | null
          tema_id: string | null
          tentativas: number | null
        }
        Relationships: []
      }
      v_ranking_individual: {
        Row: {
          campanha_id: string | null
          colaborador_id: string | null
          conhecimento: number | null
          engajamento: number | null
          matricula: string | null
          nome: string | null
          relatos: number | null
          setor_id: string | null
          total: number | null
          ultimo_ponto_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["setor_id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "v_ranking_setor"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "pontos_lancamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ranking_setor: {
        Row: {
          campanha_id: string | null
          colaboradores_ativos: number | null
          cor: string | null
          nome: string | null
          pontos_individuais: number | null
          pontos_quiz_tv: number | null
          setor_id: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _avaliar_selos: {
        Args: { p_camp: string; p_colab: string }
        Returns: string[]
      }
      _campanha_ativa: {
        Args: { p_empresa: string }
        Returns: {
          config: Json
          criado_em: string
          descricao: string | null
          empresa_id: string
          encerrada_em: string | null
          fim: string
          id: string
          inicio: string
          nome: string
          perguntas_por_dia: number
          premiacao: string | null
          ranking_visivel: boolean
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "campanhas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _cfg: {
        Args: {
          p_camp: Database["public"]["Tables"]["campanhas"]["Row"]
          p_chave: string
          p_padrao: number
        }
        Returns: number
      }
      _colaborador_da_sessao: {
        Args: { p_token: string }
        Returns: {
          anonimizado: boolean
          ativo: boolean
          bloqueado_ate: string | null
          criado_em: string
          email: string | null
          empresa_id: string
          id: string
          lgpd_aceite_em: string | null
          lgpd_aceite_versao: number | null
          matricula: string
          nome: string
          pin_fixo: string | null
          pin_hash: string | null
          pin_provisorio: boolean
          setor_id: string | null
          tentativas_falhas: number
          turno: string | null
        }
        SetofOptions: {
          from: "*"
          to: "colaboradores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _exigir_tecnico: { Args: { p_papeis?: string[] }; Returns: string }
      _lancar_pontos: {
        Args: {
          p_campanha: string
          p_colaborador: string
          p_origem: string
          p_origem_id: string
          p_pilar: string
          p_pontos: number
          p_setor: string
        }
        Returns: number
      }
      _nome_curto: { Args: { p_nome: string }; Returns: string }
      _pendencia: {
        Args: { p_colab: Database["public"]["Tables"]["colaboradores"]["Row"] }
        Returns: string
      }
      _perguntas_do_dia: {
        Args: {
          p_camp: Database["public"]["Tables"]["campanhas"]["Row"]
          p_colab: string
          p_dia: string
        }
        Returns: {
          alternativas: string[]
          correta: number
          criado_em: string
          dificuldade: number
          empresa_id: string | null
          enunciado: string
          explicacao: string | null
          id: string
          origem: string
          status: string
          tema_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "perguntas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _pin_aleatorio: { Args: never; Returns: string }
      _pin_unico: { Args: { p_empresa: string }; Returns: string }
      _registrar_atividade: {
        Args: {
          p_camp: Database["public"]["Tables"]["campanhas"]["Row"]
          p_colab: Database["public"]["Tables"]["colaboradores"]["Row"]
        }
        Returns: Json
      }
      _relato_caminho_foto: {
        Args: { p_relato: string; p_token: string }
        Returns: string
      }
      _streak: {
        Args: {
          p_camp: string
          p_colab: string
          p_dia: string
          p_ignora_fds: boolean
        }
        Returns: number
      }
      colaborador_aceitar_lgpd: { Args: { p_token: string }; Returns: Json }
      colaborador_checkin: {
        Args: { p_codigo: string; p_evento: string; p_token: string }
        Returns: Json
      }
      colaborador_concluir_conteudo: {
        Args: { p_licao: string; p_token: string }
        Returns: Json
      }
      colaborador_criar_relato: {
        Args: {
          p_categoria: string
          p_descricao: string
          p_local?: string
          p_setor?: string
          p_token: string
        }
        Returns: Json
      }
      colaborador_enviar_avaliacao: {
        Args: { p_licao: string; p_respostas: Json; p_token: string }
        Returns: Json
      }
      colaborador_licao: {
        Args: { p_licao: string; p_token: string }
        Returns: Json
      }
      colaborador_local: {
        Args: { p_local: string; p_token: string }
        Returns: Json
      }
      colaborador_login: {
        Args: { p_empresa_codigo: string; p_matricula: string; p_pin: string }
        Returns: Json
      }
      colaborador_logout: { Args: { p_token: string }; Returns: Json }
      colaborador_meus_relatos: { Args: { p_token: string }; Returns: Json }
      colaborador_perfil: { Args: { p_token: string }; Returns: Json }
      colaborador_perguntas_do_dia: { Args: { p_token: string }; Returns: Json }
      colaborador_ranking: { Args: { p_token: string }; Returns: Json }
      colaborador_responder_pergunta: {
        Args: {
          p_alternativa: number
          p_pergunta_id: string
          p_tempo_ms?: number
          p_token: string
        }
        Returns: Json
      }
      colaborador_resumo: { Args: { p_token: string }; Returns: Json }
      colaborador_termo_lgpd: { Args: { p_token: string }; Returns: Json }
      colaborador_trilha: { Args: { p_token: string }; Returns: Json }
      colaborador_trocar_pin: {
        Args: { p_pin_atual: string; p_pin_novo: string; p_token: string }
        Returns: Json
      }
      comite_responder_denuncia: {
        Args: { p_denuncia: string; p_mensagem: string; p_status?: string }
        Returns: Json
      }
      consultar_denuncia: {
        Args: { p_protocolo: string; p_senha: string }
        Returns: Json
      }
      dia_operacional: { Args: never; Returns: string }
      empresa_publica: { Args: { p_codigo: string }; Returns: Json }
      meu_papel: { Args: never; Returns: string }
      minha_empresa: { Args: never; Returns: string }
      publico_setores_da_empresa: {
        Args: { p_empresa_codigo: string }
        Returns: Json
      }
      publico_solicitar_cadastro: {
        Args: {
          p_email: string
          p_empresa_codigo: string
          p_matricula: string
          p_nome: string
          p_setor?: string
        }
        Returns: Json
      }
      registrar_denuncia_assedio: {
        Args: {
          p_categoria: string
          p_descricao: string
          p_empresa_codigo: string
          p_local?: string
          p_periodo?: string
          p_quer_retorno?: boolean
        }
        Returns: Json
      }
      responder_denuncia_denunciante: {
        Args: { p_mensagem: string; p_protocolo: string; p_senha: string }
        Returns: Json
      }
      sou_comite_assedio: { Args: never; Returns: boolean }
      tecnico_anonimizar_colaborador: {
        Args: { p_colaborador: string }
        Returns: Json
      }
      tecnico_ativar_campanha: { Args: { p_campanha: string }; Returns: Json }
      tecnico_atualizar_relato: {
        Args: {
          p_comentario?: string
          p_relato: string
          p_status: string
          p_visivel?: boolean
        }
        Returns: Json
      }
      tecnico_decidir_solicitacao: {
        Args: {
          p_aprovar: boolean
          p_id: string
          p_motivo?: string
          p_setor?: string
        }
        Returns: Json
      }
      tecnico_desbloquear_colaborador: {
        Args: { p_colaborador: string }
        Returns: Json
      }
      tecnico_encerrar_campanha: {
        Args: { p_campanha: string; p_top_n?: number }
        Returns: Json
      }
      tecnico_gerar_pins: {
        Args: { p_colaboradores: string[] }
        Returns: {
          colaborador_id: string
          matricula: string
          nome: string
          pin: string
          setor: string
        }[]
      }
      tecnico_importar_colaboradores: {
        Args: { p_linhas: Json }
        Returns: Json
      }
      tecnico_reemitir_pin: { Args: { p_colaborador: string }; Returns: Json }
      tecnico_rotacionar_codigo: { Args: { p_evento: string }; Returns: Json }
      tecnico_salvar_quiz_tv: {
        Args: {
          p_duracao_ms: number
          p_equipes: Json
          p_evento: string
          p_modo: string
          p_respostas: Json
        }
        Returns: Json
      }
      tecnico_validar_relato: {
        Args: {
          p_comentario?: string
          p_decisao: string
          p_duplicado_de?: string
          p_gravidade?: string
          p_relato: string
        }
        Returns: Json
      }
      tecnico_ver_pin: { Args: { p_colaborador: string }; Returns: Json }
      verificar_certificado: { Args: { p_codigo: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
