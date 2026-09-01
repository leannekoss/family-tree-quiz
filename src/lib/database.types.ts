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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          added_at: string
          email: string
          note: string | null
        }
        Insert: {
          added_at?: string
          email: string
          note?: string | null
        }
        Update: {
          added_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      anecdotes: {
        Row: {
          id: number
          ordre: number
          person_id: string | null
          place_id: number | null
          pour_camp: string | null
          source: string
          texte: string
          titre: string
        }
        Insert: {
          id?: number
          ordre?: number
          person_id?: string | null
          place_id?: number | null
          pour_camp?: string | null
          source: string
          texte: string
          titre: string
        }
        Update: {
          id?: number
          ordre?: number
          person_id?: string | null
          place_id?: number | null
          pour_camp?: string | null
          source?: string
          texte?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "anecdotes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anecdotes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      duel_members: {
        Row: {
          duel_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          duel_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          duel_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_members_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: []
      }
      familysearch_import: {
        Row: {
          mort: number | null
          ne: number | null
          nom_complet: string
          person_id: string | null
          pid: string
          releve_le: string
          sexe: string | null
          source: string | null
        }
        Insert: {
          mort?: number | null
          ne?: number | null
          nom_complet: string
          person_id?: string | null
          pid: string
          releve_le?: string
          sexe?: string | null
          source?: string | null
        }
        Update: {
          mort?: number | null
          ne?: number | null
          nom_complet?: string
          person_id?: string | null
          pid?: string
          releve_le?: string
          sexe?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "familysearch_import_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      group_photos: {
        Row: {
          caption: string
          id: number
          source: string
          storage_path: string
          taken: string | null
        }
        Insert: {
          caption: string
          id?: number
          source: string
          storage_path: string
          taken?: string | null
        }
        Update: {
          caption?: string
          id?: number
          source?: string
          storage_path?: string
          taken?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          is_admin: boolean
          joined_at: string
          nom_declare: string | null
          person_id: string | null
          user_id: string
        }
        Insert: {
          is_admin?: boolean
          joined_at?: string
          nom_declare?: string | null
          person_id?: string | null
          user_id: string
        }
        Update: {
          is_admin?: boolean
          joined_at?: string
          nom_declare?: string | null
          person_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          birth_day: number | null
          birth_display: string | null
          birth_month: number | null
          birth_place: string | null
          birth_year: number | null
          blason: string | null
          branch_id: number | null
          collateral: boolean
          created_at: string
          death_display: string | null
          death_place: string | null
          death_year: number | null
          deceased: boolean
          emoji: string | null
          father_id: string | null
          first_name: string
          hors_quiz: boolean
          id: string
          last_name: string
          married_name: string | null
          mother_id: string | null
          nickname: string | null
          notes: string | null
          photo_url: string | null
          place_detail: string | null
          place_id: number | null
          search_text: string | null
          sex: string | null
        }
        Insert: {
          birth_day?: number | null
          birth_display?: string | null
          birth_month?: number | null
          birth_place?: string | null
          birth_year?: number | null
          blason?: string | null
          branch_id?: number | null
          collateral?: boolean
          created_at?: string
          death_display?: string | null
          death_place?: string | null
          death_year?: number | null
          deceased?: boolean
          emoji?: string | null
          father_id?: string | null
          first_name: string
          hors_quiz?: boolean
          id?: string
          last_name: string
          married_name?: string | null
          mother_id?: string | null
          nickname?: string | null
          notes?: string | null
          photo_url?: string | null
          place_detail?: string | null
          place_id?: number | null
          search_text?: string | null
          sex?: string | null
        }
        Update: {
          birth_day?: number | null
          birth_display?: string | null
          birth_month?: number | null
          birth_place?: string | null
          birth_year?: number | null
          blason?: string | null
          branch_id?: number | null
          collateral?: boolean
          created_at?: string
          death_display?: string | null
          death_place?: string | null
          death_year?: number | null
          deceased?: boolean
          emoji?: string | null
          father_id?: string | null
          first_name?: string
          hors_quiz?: boolean
          id?: string
          last_name?: string
          married_name?: string | null
          mother_id?: string | null
          nickname?: string | null
          notes?: string | null
          photo_url?: string | null
          place_detail?: string | null
          place_id?: number | null
          search_text?: string | null
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_candidates: {
        Row: {
          confiance: string
          id: number
          person_id: string
          refused_by: string[]
          source_site: string
          source_title: string
          source_url: string
          storage_path: string
          why: string | null
        }
        Insert: {
          confiance?: string
          id?: number
          person_id: string
          refused_by?: string[]
          source_site: string
          source_title: string
          source_url: string
          storage_path: string
          why?: string | null
        }
        Update: {
          confiance?: string
          id?: number
          person_id?: string
          refused_by?: string[]
          source_site?: string
          source_title?: string
          source_url?: string
          storage_path?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_candidates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_marks: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          named_at: string | null
          named_by: string | null
          person_id: string | null
          photo_id: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          named_at?: string | null
          named_by?: string | null
          person_id?: string | null
          photo_id: number
          x: number
          y: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          named_at?: string | null
          named_by?: string | null
          person_id?: string | null
          photo_id?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "photo_marks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_marks_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "group_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_tasks: {
        Row: {
          id: number
          passed_by: string[]
          person_id: string
          photo_id: number
          position: string | null
        }
        Insert: {
          id?: number
          passed_by?: string[]
          person_id: string
          photo_id: number
          position?: string | null
        }
        Update: {
          id?: number
          passed_by?: string[]
          person_id?: string
          photo_id?: number
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_tasks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_tasks_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "group_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      place_stories: {
        Row: {
          auteur: string
          created_at: string
          id: number
          place_id: number
          texte: string
          user_id: string
        }
        Insert: {
          auteur: string
          created_at?: string
          id?: never
          place_id: number
          texte: string
          user_id?: string
        }
        Update: {
          auteur?: string
          created_at?: string
          id?: never
          place_id?: number
          texte?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_stories_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          commune: string | null
          geo_precision: string | null
          geo_source: string | null
          histoire: string | null
          histoire_source: string | null
          id: number
          lat: number | null
          lon: number | null
          name: string
          note: string | null
          occupants: string | null
          outside: boolean
          resume: string | null
        }
        Insert: {
          commune?: string | null
          geo_precision?: string | null
          geo_source?: string | null
          histoire?: string | null
          histoire_source?: string | null
          id?: number
          lat?: number | null
          lon?: number | null
          name: string
          note?: string | null
          occupants?: string | null
          outside?: boolean
          resume?: string | null
        }
        Update: {
          commune?: string | null
          geo_precision?: string | null
          geo_source?: string | null
          histoire?: string | null
          histoire_source?: string | null
          id?: number
          lat?: number | null
          lon?: number | null
          name?: string
          note?: string | null
          occupants?: string | null
          outside?: boolean
          resume?: string | null
        }
        Relationships: []
      }
      remerciements: {
        Row: {
          created_at: string
          id: number
          ordre: number
          person_ids: string[] | null
          quand: string | null
          qui: string
          quoi: string
        }
        Insert: {
          created_at?: string
          id?: number
          ordre?: number
          person_ids?: string[] | null
          quand?: string | null
          qui: string
          quoi: string
        }
        Update: {
          created_at?: string
          id?: number
          ordre?: number
          person_ids?: string[] | null
          quand?: string | null
          qui?: string
          quoi?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          branche: string | null
          id: number
          justes: number
          played_at: string
          pseudo: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          branche?: string | null
          id?: never
          justes: number
          played_at?: string
          pseudo: string
          score: number
          total: number
          user_id: string
        }
        Update: {
          branche?: string | null
          id?: never
          justes?: number
          played_at?: string
          pseudo?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      unions: {
        Row: {
          date_display: string | null
          id: string
          kind: string
          p1_id: string
          p2_id: string
        }
        Insert: {
          date_display?: string | null
          id?: string
          kind?: string
          p1_id: string
          p2_id: string
        }
        Update: {
          date_display?: string | null
          id?: string
          kind?: string
          p1_id?: string
          p2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unions_p1_id_fkey"
            columns: ["p1_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unions_p2_id_fkey"
            columns: ["p2_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anecdote_du_jour: {
        Args: never
        Returns: {
          combien: number
          id: number
          maison: string
          nom: string
          person_id: string
          photo_url: string
          place_id: number
          prenom: string
          source: string
          texte: string
          titre: string
        }[]
      }
      anniversaires: {
        Args: { fenetre?: number }
        Returns: {
          age: number
          dans_x_jours: number
          id: string
          jour: number
          mois: number
          nom: string
          photo_url: string
          prenom: string
          rond: boolean
        }[]
      }
      arrivees: {
        Args: { jours?: number }
        Returns: {
          ce_jour_la: number
          jour: string
          sur_la_periode: number
          total: number
        }[]
      }
      camp_de: { Args: { branche: string }; Returns: string }
      chercher_ailleurs: {
        Args: { q: string }
        Returns: {
          deja_id: string
          mort: number
          ne: number
          nom_complet: string
          pid: string
          sexe: string
        }[]
      }
      classement: {
        Args: { combien?: number }
        Returns: {
          a_moi: boolean
          emoji: string
          justes: number
          person_id: string
          photo_url: string
          played_at: string
          pseudo: string
          score: number
          serie: number
          total: number
        }[]
      }
      classement_branches: {
        Args: never
        Returns: {
          branche: string
          champion: string
          champion_id: string
          joueurs: number
          meilleur: number
        }[]
      }
      classement_camps: {
        Args: never
        Returns: {
          branches: number
          camp: string
          champion: string
          champion_id: string
          joueurs: number
          meilleur: number
        }[]
      }
      classement_du_jour: {
        Args: { combien?: number }
        Returns: {
          a_moi: boolean
          emoji: string
          justes: number
          person_id: string
          photo_url: string
          pseudo: string
          score: number
          total: number
        }[]
      }
      classement_duel: {
        Args: { code_duel: string }
        Returns: {
          a_moi: boolean
          emoji: string
          justes: number
          person_id: string
          photo_url: string
          played_at: string
          pseudo: string
          score: number
          serie: number
          total: number
        }[]
      }
      contributeurs: {
        Args: never
        Returns: {
          a_moi: boolean
          corrections: number
          fiches: number
          person_id: string
          photos: number
          points: number
          pseudo: string
        }[]
      }
      defi_semaine: {
        Args: never
        Returns: {
          camp: string
          jours_restants: number
          photos: number
        }[]
      }
      duel_par_code: {
        Args: { code_duel: string }
        Returns: {
          code: string
          created_at: string
          id: string
          pseudo_createur: string
        }[]
      }
      elide: { Args: { prenom: string }; Returns: string }
      exporter_migrations: {
        Args: never
        Returns: {
          nom: string
          sql: string
          version: string
        }[]
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      indice_code: { Args: never; Returns: string }
      invite_code: { Args: never; Returns: string }
      inviter_membre: {
        Args: { nouvel_email: string; qui?: string; secret?: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      join_family: { Args: { code: string }; Returns: undefined }
      joueurs_actifs: {
        Args: never
        Returns: {
          pseudo: string
          user_id: string
        }[]
      }
      journal_famille: {
        Args: { depuis_jours?: number }
        Returns: {
          detail: string
          id: number
          quand: string
          qui: string
          quoi: string
          sujet: string
          sujet_id: string
        }[]
      }
      ma_serie: {
        Args: never
        Returns: {
          joue_aujourdhui: boolean
          jours: number
        }[]
      }
      me_declarer: { Args: { nom: string }; Returns: string }
      mes_premiers_pas: {
        Args: never
        Returns: {
          a_donne: boolean
          a_emoji: boolean
          a_joue: boolean
          a_photo: boolean
          faits: number
          person_id: string
          prenom: string
        }[]
      }
      mon_niveau: {
        Args: never
        Returns: {
          corrections: number
          fiches: number
          histoires: number
          jours: number
          niveau: number
          parties: number
          photos: number
          points: number
          prochain: number
          restant: number
          titre: string
          titre_prochain: string
        }[]
      }
      parente: {
        Args: { cible: string }
        Returns: {
          ancetres: Json
          conjoint: Json
          d_cible: number
          d_moi: number
          lien_kind: string
          parents_communs: number
          relation: string
        }[]
      }
      parente_entre: {
        Args: { cible: string; moi: string }
        Returns: {
          ancetres: Json
          conjoint: Json
          d_cible: number
          d_moi: number
          lien_kind: string
          parents_communs: number
          relation: string
        }[]
      }
      passer_tache: { Args: { tache: number }; Returns: undefined }
      fam_jour: { Args: { display: string }; Returns: number }
      fam_mois: { Args: { display: string }; Returns: number }
      fam_year: { Args: { display: string }; Returns: number }
      photos_de_groupe: {
        Args: never
        Returns: {
          anonymes: number
          caption: string
          id: number
          nommes: number
          reperes: number
          source: string
          storage_path: string
          taken: string
        }[]
      }
      refuser_candidat: { Args: { candidat: number }; Returns: undefined }
      regler_acces: {
        Args: { nouveau_code?: string; ouvert?: boolean }
        Returns: string
      }
      rejoindre_avec_code: {
        Args: { code: string; mon_email: string }
        Returns: string
      }
      restaurer_fiche: { Args: { audit_id: number }; Returns: string }
      search_people: {
        Args: { q: string }
        Returns: {
          birth_display: string
          branch_name: string
          deceased: boolean
          first_name: string
          id: string
          last_name: string
          married_name: string
          photo_url: string
          score: number
          sex: string
        }[]
      }
      search_places: {
        Args: { q: string }
        Returns: {
          commune: string
          habitants: number
          id: number
          name: string
          occupants: string
          score: number
        }[]
      }
      series_par_joueur: {
        Args: never
        Returns: {
          joue_aujourdhui: boolean
          jours: number
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      siblings: {
        Args: { target: string }
        Returns: {
          birth_display: string
          branch_id: number
          death_display: string
          deceased: boolean
          first_name: string
          id: string
          kind: string
          last_name: string
          married_name: string
          photo_url: string
          sex: string
        }[]
      }
      stats_famille: { Args: never; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      visages_manquants: {
        Args: never
        Returns: {
          birth_display: string
          branche: string
          deceased: boolean
          first_name: string
          id: string
          last_name: string
          married_name: string
          piste: string
          sex: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export type Stats = Database["public"]["Functions"]["mon_niveau"]["Returns"][number];

export const Constants = {
  public: {
    Enums: {},
  },
} as const
