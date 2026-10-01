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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acessos_qrcode: {
        Row: {
          acao: string
          created_at: string | null
          data: string | null
          dispositivo: string | null
          hora: string | null
          id: string
          pontuou: boolean | null
          turma_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          data?: string | null
          dispositivo?: string | null
          hora?: string | null
          id?: string
          pontuou?: boolean | null
          turma_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          data?: string | null
          dispositivo?: string | null
          hora?: string | null
          id?: string
          pontuou?: boolean | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acessos_qrcode_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      compartilhamentos: {
        Row: {
          created_at: string | null
          data: string | null
          dispositivo_id: string | null
          hora: string | null
          id: string
          plataforma: string | null
          turma_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          dispositivo_id?: string | null
          hora?: string | null
          id?: string
          plataforma?: string | null
          turma_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          dispositivo_id?: string | null
          hora?: string | null
          id?: string
          plataforma?: string | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compartilhamentos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_calendario: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          horario: string | null
          id: string
          status: string | null
          tipo: string | null
          titulo: string
          turma_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao?: string | null
          horario?: string | null
          id?: string
          status?: string | null
          tipo?: string | null
          titulo: string
          turma_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          horario?: string | null
          id?: string
          status?: string | null
          tipo?: string | null
          titulo?: string
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_calendario_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes: {
        Row: {
          created_at: string | null
          dispositivo_id: string
          id: string
          papel: string
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          dispositivo_id: string
          id?: string
          papel?: string
          turma_id: string
        }
        Update: {
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          papel?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      perguntas: {
        Row: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          created_at: string | null
          enunciado: string
          id: string
          resposta_correta: string
          status: string | null
        }
        Insert: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          created_at?: string | null
          enunciado: string
          id?: string
          resposta_correta: string
          status?: string | null
        }
        Update: {
          alternativa_a?: string
          alternativa_b?: string
          alternativa_c?: string
          alternativa_d?: string
          created_at?: string | null
          enunciado?: string
          id?: string
          resposta_correta?: string
          status?: string | null
        }
        Relationships: []
      }
      quiz_tv: {
        Row: {
          acertos: number
          created_at: string | null
          data: string | null
          erros: number
          id: string
          pontuacao: number
          tempo_total_ms: number | null
          total_perguntas: number
          turma_id: string | null
        }
        Insert: {
          acertos?: number
          created_at?: string | null
          data?: string | null
          erros?: number
          id?: string
          pontuacao?: number
          tempo_total_ms?: number | null
          total_perguntas?: number
          turma_id?: string | null
        }
        Update: {
          acertos?: number
          created_at?: string | null
          data?: string | null
          erros?: number
          id?: string
          pontuacao?: number
          tempo_total_ms?: number | null
          total_perguntas?: number
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tv_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tv_respostas: {
        Row: {
          acertou: boolean
          alternativa_escolhida: string
          created_at: string | null
          id: string
          ordem: number
          pergunta_id: string | null
          quiz_tv_id: string | null
          tempo_resposta_ms: number | null
          turma_id: string | null
        }
        Insert: {
          acertou: boolean
          alternativa_escolhida: string
          created_at?: string | null
          id?: string
          ordem: number
          pergunta_id?: string | null
          quiz_tv_id?: string | null
          tempo_resposta_ms?: number | null
          turma_id?: string | null
        }
        Update: {
          acertou?: boolean
          alternativa_escolhida?: string
          created_at?: string | null
          id?: string
          ordem?: number
          pergunta_id?: string | null
          quiz_tv_id?: string | null
          tempo_resposta_ms?: number | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tv_respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_quiz_tv_id_fkey"
            columns: ["quiz_tv_id"]
            isOneToOne: false
            referencedRelation: "quiz_tv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tv_respostas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_alunos: {
        Row: {
          acertou: boolean
          alternativa_escolhida: string
          created_at: string | null
          data: string | null
          dispositivo: string | null
          dispositivo_id: string | null
          hora: string | null
          id: string
          pergunta_id: string | null
          tempo_resposta_ms: number | null
          turma_id: string | null
        }
        Insert: {
          acertou: boolean
          alternativa_escolhida: string
          created_at?: string | null
          data?: string | null
          dispositivo?: string | null
          dispositivo_id?: string | null
          hora?: string | null
          id?: string
          pergunta_id?: string | null
          tempo_resposta_ms?: number | null
          turma_id?: string | null
        }
        Update: {
          acertou?: boolean
          alternativa_escolhida?: string
          created_at?: string | null
          data?: string | null
          dispositivo?: string | null
          dispositivo_id?: string | null
          hora?: string | null
          id?: string
          pergunta_id?: string | null
          tempo_resposta_ms?: number | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_alunos_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          pontuacao_compartilhamento: number | null
          pontuacao_qrcode: number | null
          pontuacao_quiz_tv: number | null
          qr_code_url: string | null
          quantidade_alunos: number | null
          serie: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          pontuacao_compartilhamento?: number | null
          pontuacao_qrcode?: number | null
          pontuacao_quiz_tv?: number | null
          qr_code_url?: string | null
          quantidade_alunos?: number | null
          serie: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          pontuacao_compartilhamento?: number | null
          pontuacao_qrcode?: number | null
          pontuacao_quiz_tv?: number | null
          qr_code_url?: string | null
          quantidade_alunos?: number | null
          serie?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dia_de_campanha: { Args: { dia: string }; Returns: boolean }
      dia_do_jogo: { Args: never; Returns: string }
      incrementar_pontuacao_compartilhamento: {
        Args: { turma_id_param: string }
        Returns: undefined
      }
      incrementar_pontuacao_quiz_tv: {
        Args: { pontos: number; turma_id_param: string }
        Returns: undefined
      }
      liberar_lider: { Args: { turma_id_param: string }; Returns: undefined }
      registrar_acesso: {
        Args: { dispositivo_tipo_param?: string; turma_id_param: string }
        Returns: undefined
      }
      registrar_compartilhamento: {
        Args: {
          dispositivo_param: string
          dispositivo_tipo_param?: string
          plataforma_param?: string
          turma_id_param: string
        }
        Returns: Json
      }
      registrar_participante: {
        Args: { dispositivo_param: string; turma_id_param: string }
        Returns: string
      }
      responder_pergunta_diaria: {
        Args: {
          alternativa_param: string
          dispositivo_param: string
          dispositivo_tipo_param?: string
          pergunta_id_param: string
          tempo_ms_param?: number
          turma_id_param: string
        }
        Returns: Json
      }
      salvar_quiz_tv: {
        Args: {
          respostas_param: Json
          tempo_total_param?: number
          turma_id_param: string
        }
        Returns: Json
      }
      taxa_acerto_por_pergunta: {
        Args: never
        Returns: {
          enunciado: string
          pergunta_id: string
          taxa_acerto: number
          total_acertos: number
          total_erros: number
          total_tentativas: number
        }[]
      }
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
