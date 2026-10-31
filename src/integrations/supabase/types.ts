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
      // NOTE: estabelecimentos e estabelecimento_membros foram criados direto no editor de SQL
      // (não pela ferramenta de migração do Lovable); estes tipos espelham o script e serão
      // substituídos quando o Lovable regenerar este arquivo a partir do banco.
      // NOTE: categorias, produtos e mesas também foram criadas direto no editor de SQL;
      // tipos escritos à mão espelhando o script (o Lovable pode regenerar este arquivo).
      categorias: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          estabelecimento_id: string
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          estabelecimento_id: string
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          estabelecimento_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      mesas: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          estabelecimento_id: string
          id: string
          numero: number
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          estabelecimento_id: string
          id?: string
          numero: number
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          estabelecimento_id?: string
          id?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "mesas_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          atualizado_em: string
          categoria_id: string
          criado_em: string
          descricao: string | null
          disponivel: boolean
          estabelecimento_id: string
          estoque_qtd: number
          foto_path: string | null
          id: string
          inativar_ao_zerar_estoque: boolean
          nome: string
          preco_custo_centavos: number | null
          preco_venda_centavos: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id: string
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          estabelecimento_id: string
          estoque_qtd?: number
          foto_path?: string | null
          id?: string
          inativar_ao_zerar_estoque?: boolean
          nome: string
          preco_custo_centavos?: number | null
          preco_venda_centavos: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string
          criado_em?: string
          descricao?: string | null
          disponivel?: boolean
          estabelecimento_id?: string
          estoque_qtd?: number
          foto_path?: string | null
          id?: string
          inativar_ao_zerar_estoque?: boolean
          nome?: string
          preco_custo_centavos?: number | null
          preco_venda_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "produtos_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_categoria_fkey"
            columns: ["categoria_id", "estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id", "estabelecimento_id"]
          },
        ]
      }
      estabelecimento_membros: {
        Row: {
          criado_em: string
          estabelecimento_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          estabelecimento_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          estabelecimento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estabelecimento_membros_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estabelecimento_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["user_id"]
          },
        ]
      }
      estabelecimentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor_primaria: string | null
          cor_secundaria: string | null
          criado_em: string
          descricao: string | null
          destaques: string[]
          endereco: string | null
          horario_funcionamento: string | null
          id: string
          logo_url: string | null
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          criado_em?: string
          descricao?: string | null
          destaques?: string[]
          endereco?: string | null
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          criado_em?: string
          descricao?: string | null
          destaques?: string[]
          endereco?: string | null
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      movimentos_estoque: {
        Row: {
          criado_em: string
          estabelecimento_id: string
          id: string
          nome_produto: string
          observacao: string | null
          produto_id: string | null
          saldo_apos: number
          tipo: Database["public"]["Enums"]["tipo_movimento_estoque"]
          usuario_id: string | null
          variacao: number
        }
        Insert: {
          criado_em?: string
          estabelecimento_id: string
          id?: string
          nome_produto: string
          observacao?: string | null
          produto_id?: string | null
          saldo_apos: number
          tipo: Database["public"]["Enums"]["tipo_movimento_estoque"]
          usuario_id?: string | null
          variacao: number
        }
        Update: {
          criado_em?: string
          estabelecimento_id?: string
          id?: string
          nome_produto?: string
          observacao?: string | null
          produto_id?: string | null
          saldo_apos?: number
          tipo?: Database["public"]["Enums"]["tipo_movimento_estoque"]
          usuario_id?: string | null
          variacao?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_estoque_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          atualizado_em: string
          criado_em: string
          deve_trocar_senha: boolean
          papel: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          deve_trocar_senha?: boolean
          papel: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          deve_trocar_senha?: boolean
          papel?: Database["public"]["Enums"]["papel_app"]
          user_id?: string
        }
        Relationships: []
      }
      // NOTE: sessoes_mesa, comandas, pedidos, itens_pedido e pagamentos (docs/sql/08_pedidos.sql):
      // o painel só LÊ (escrita apenas pelas funções); comandas não expõe token_hash (sem permissão).
      // NOTE: caixas e movimentos_caixa (docs/sql/09_caixa.sql): o painel só LÊ; escrita só pelas funções.
      caixas: {
        Row: {
          abertura_centavos: number
          aberto_em: string
          aberto_por: string | null
          contado_centavos: number | null
          diferenca_centavos: number | null
          esperado_centavos: number | null
          estabelecimento_id: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacao_fechamento: string | null
          status: Database["public"]["Enums"]["status_caixa"]
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      movimentos_caixa: {
        Row: {
          caixa_id: string
          criado_em: string
          criado_por: string | null
          estabelecimento_id: string
          id: string
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_movimento_caixa"]
          valor_centavos: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      sessoes_mesa: {
        Row: {
          aberta_em: string
          encerrada_em: string | null
          estabelecimento_id: string
          id: string
          mesa_id: string
          status: Database["public"]["Enums"]["status_sessao"]
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      comandas: {
        Row: {
          aberta_em: string
          cliente_nome: string
          estabelecimento_id: string
          fechada_em: string | null
          id: string
          mesa_id: string
          mesa_numero: number
          sessao_id: string
          status: Database["public"]["Enums"]["status_comanda"]
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      pedidos: {
        Row: {
          comanda_id: string
          confirmado_em: string | null
          criado_em: string
          estabelecimento_id: string
          expira_em: string
          id: string
          mesa_id: string
          motivo_rejeicao: string | null
          rejeitado_em: string | null
          sessao_id: string
          status: Database["public"]["Enums"]["status_pedido"]
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      itens_pedido: {
        Row: {
          cancelado_em: string | null
          custo_unitario_centavos: number | null
          entregue_em: string | null
          estabelecimento_id: string
          id: string
          motivo_cancelamento: string | null
          nome_produto: string
          pedido_id: string
          preco_unitario_centavos: number
          produto_id: string | null
          quantidade: number
          status: Database["public"]["Enums"]["status_item"]
          subtotal_centavos: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      pagamentos: {
        Row: {
          caixa_id: string | null
          comanda_id: string
          criado_em: string
          estabelecimento_id: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacao: string | null
          recebido_centavos: number | null
          troco_centavos: number | null
          valor_centavos: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_caixa: { Args: { _empresa: string; _valor: number }; Returns: string }
      fechar_caixa: {
        Args: { _caixa: string; _contado: number; _observacao?: string }
        Returns: number
      }
      movimentar_caixa: {
        Args: {
          _caixa: string
          _motivo: string
          _tipo: Database["public"]["Enums"]["tipo_movimento_caixa"]
          _valor: number
        }
        Returns: string
      }
      resumo_caixa: { Args: { _caixa: string }; Returns: Json }
      ajustar_estoque: {
        Args: {
          _observacao?: string
          _produto: string
          _quantidade: number
          _tipo: Database["public"]["Enums"]["tipo_movimento_estoque"]
        }
        Returns: number
      }
      cancelar_item: { Args: { _item: string; _motivo: string }; Returns: undefined }
      cancelar_meu_pedido: { Args: { _pedido: string; _token: string }; Returns: undefined }
      confirmar_pedido: { Args: { _pedido: string }; Returns: undefined }
      enviar_pedido: { Args: { _itens: Json; _token: string }; Returns: string }
      entregar_itens: { Args: { _itens: string[] }; Returns: number }
      entregar_pedido: { Args: { _pedido: string }; Returns: number }
      excluir_pagamento: { Args: { _pagamento: string }; Returns: undefined }
      fechar_comanda: { Args: { _comanda: string }; Returns: undefined }
      identificar_cliente: {
        Args: { _nome: string; _numero: number; _slug: string }
        Returns: Json
      }
      iniciar_fechamento_mesa: { Args: { _mesa: string }; Returns: undefined }
      liberar_mesa: { Args: { _mesa: string }; Returns: undefined }
      minha_comanda: { Args: { _token: string }; Returns: Json }
      obter_cardapio_publico: { Args: { _numero: number; _slug: string }; Returns: Json }
      registrar_pagamento: {
        Args: {
          _comanda: string
          _forma: Database["public"]["Enums"]["forma_pagamento"]
          _observacao?: string
          _recebido?: number
          _valor: number
        }
        Returns: string
      }
      rejeitar_pedido: { Args: { _motivo?: string; _pedido: string }; Returns: undefined }
      retomar_atendimento_mesa: { Args: { _mesa: string }; Returns: undefined }
      eh_master: { Args: never; Returns: boolean }
      eh_membro: { Args: { _estabelecimento: string }; Returns: boolean }
      marcar_senha_trocada: { Args: never; Returns: undefined }
      obter_apresentacao_publica: { Args: { _slug: string }; Returns: Json }
      obter_estabelecimento_publico: {
        Args: { _slug: string }
        Returns: {
          cor_primaria: string
          cor_secundaria: string
          id: string
          logo_url: string
          nome: string
          slug: string
        }[]
      }
      tem_acesso_estabelecimento: { Args: { _estabelecimento: string }; Returns: boolean }
    }
    Enums: {
      papel_app: "admin" | "master"
      forma_pagamento: "dinheiro" | "pix" | "debito" | "credito" | "outro"
      status_caixa: "aberto" | "fechado"
      status_comanda: "aberta" | "paga"
      status_item: "aguardando" | "entregue" | "cancelado"
      status_pedido: "pendente" | "confirmado" | "rejeitado" | "cancelado"
      status_sessao: "aberta" | "fechamento" | "encerrada"
      tipo_movimento_caixa: "sangria" | "reforco"
      tipo_movimento_estoque:
        | "saldo_inicial"
        | "reposicao"
        | "alteracao_quantidade"
        | "baixa_avaria"
        | "baixa_entrega"
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
    Enums: {
      papel_app: ["admin", "master"],
    },
  },
} as const
