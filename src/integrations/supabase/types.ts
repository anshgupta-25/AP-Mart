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
      addresses: {
        Row: {
          building: string | null
          city: string
          created_at: string
          house_no: string | null
          id: string
          is_default: boolean
          landmark: string | null
          lat: number | null
          line1: string
          line2: string | null
          lng: number | null
          name: string
          phone: string
          pincode: string
          state: string
          type: Database["public"]["Enums"]["address_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          building?: string | null
          city: string
          created_at?: string
          house_no?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          lat?: number | null
          line1: string
          line2?: string | null
          lng?: number | null
          name: string
          phone: string
          pincode: string
          state: string
          type?: Database["public"]["Enums"]["address_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          building?: string | null
          city?: string
          created_at?: string
          house_no?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          lat?: number | null
          line1?: string
          line2?: string | null
          lng?: number | null
          name?: string
          phone?: string
          pincode?: string
          state?: string
          type?: Database["public"]["Enums"]["address_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          shop_id: string | null
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          shop_id?: string | null
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          shop_id?: string | null
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          max_discount: number | null
          min_order: number
          times_used: number
          type: Database["public"]["Enums"]["coupon_type"]
          usage_limit: number | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
          times_used?: number
          type: Database["public"]["Enums"]["coupon_type"]
          usage_limit?: number | null
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
          times_used?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      delivery_messages: {
        Row: {
          created_at: string
          customer_id: string
          delivery_partner_id: string
          id: string
          kind: string
          message: string
          order_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_partner_id: string
          id?: string
          kind: string
          message: string
          order_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_partner_id?: string
          id?: string
          kind?: string
          message?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_messages_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_partners: {
        Row: {
          active_order_count: number
          availability_status: string
          created_at: string
          current_lat: number | null
          current_lng: number | null
          current_order_id: string | null
          eta_minutes: number | null
          id: string
          is_online: boolean
          name: string
          phone: string | null
          rating: number
          shop_id: string | null
          status_updated_at: string
          updated_at: string
          user_id: string
          vehicle: string | null
        }
        Insert: {
          active_order_count?: number
          availability_status?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_order_id?: string | null
          eta_minutes?: number | null
          id?: string
          is_online?: boolean
          name: string
          phone?: string | null
          rating?: number
          shop_id?: string | null
          status_updated_at?: string
          updated_at?: string
          user_id: string
          vehicle?: string | null
        }
        Update: {
          active_order_count?: number
          availability_status?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          current_order_id?: string | null
          eta_minutes?: number | null
          id?: string
          is_online?: boolean
          name?: string
          phone?: string | null
          rating?: number
          shop_id?: string | null
          status_updated_at?: string
          updated_at?: string
          user_id?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_partners_current_order_id_fkey"
            columns: ["current_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_partners_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zone_settings: {
        Row: {
          city: string
          created_at: string
          default_handling_fee: number
          delivery_radius_km: number
          express_enabled: boolean
          express_eta_minutes: string
          express_fee: number
          express_handling_fee: number | null
          fast_enabled: boolean
          fast_eta_minutes: string
          fast_fee: number
          fast_handling_fee: number | null
          free_handling_above: number | null
          handling_enabled: boolean
          handling_percentage: number
          handling_type: string
          id: string
          is_active: boolean
          minimum_order_express: number | null
          minimum_order_fast: number | null
          minimum_order_standard: number | null
          pin_code: string
          standard_enabled: boolean
          standard_eta_minutes: string
          standard_fee: number
          standard_handling_fee: number | null
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          default_handling_fee?: number
          delivery_radius_km?: number
          express_enabled?: boolean
          express_eta_minutes?: string
          express_fee?: number
          express_handling_fee?: number | null
          fast_enabled?: boolean
          fast_eta_minutes?: string
          fast_fee?: number
          fast_handling_fee?: number | null
          free_handling_above?: number | null
          handling_enabled?: boolean
          handling_percentage?: number
          handling_type?: string
          id?: string
          is_active?: boolean
          minimum_order_express?: number | null
          minimum_order_fast?: number | null
          minimum_order_standard?: number | null
          pin_code: string
          standard_enabled?: boolean
          standard_eta_minutes?: string
          standard_fee?: number
          standard_handling_fee?: number | null
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          default_handling_fee?: number
          delivery_radius_km?: number
          express_enabled?: boolean
          express_eta_minutes?: string
          express_fee?: number
          express_handling_fee?: number | null
          fast_enabled?: boolean
          fast_eta_minutes?: string
          fast_fee?: number
          fast_handling_fee?: number | null
          free_handling_above?: number | null
          handling_enabled?: boolean
          handling_percentage?: number
          handling_type?: string
          id?: string
          is_active?: boolean
          minimum_order_express?: number | null
          minimum_order_fast?: number | null
          minimum_order_standard?: number | null
          pin_code?: string
          standard_enabled?: boolean
          standard_eta_minutes?: string
          standard_fee?: number
          standard_handling_fee?: number | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          child_order_id: string | null
          created_at: string
          expires_at: string
          id: string
          parent_order_id: string
          quantity: number
          released: boolean
          released_reason: string | null
          shop_product_id: string
        }
        Insert: {
          child_order_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          parent_order_id: string
          quantity: number
          released?: boolean
          released_reason?: string | null
          shop_product_id: string
        }
        Update: {
          child_order_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          parent_order_id?: string
          quantity?: number
          released?: boolean
          released_reason?: string | null
          shop_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_shop_product_id_fkey"
            columns: ["shop_product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          pincode: string
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          pincode: string
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          pincode?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_dispatch_log: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          notification_id: string | null
          request_id: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          request_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          request_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          in_app_enabled: boolean
          inventory_alerts: boolean
          order_updates: boolean
          promotions: boolean
          push_enabled: boolean
          system_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          inventory_alerts?: boolean
          order_updates?: boolean
          promotions?: boolean
          push_enabled?: boolean
          system_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          inventory_alerts?: boolean
          order_updates?: boolean
          promotions?: boolean
          push_enabled?: boolean
          system_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          data: Json
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          badge: string | null
          created_at: string
          created_by: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          scope: Database["public"]["Enums"]["offer_scope"]
          shop_id: string | null
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          scope?: Database["public"]["Enums"]["offer_scope"]
          shop_id?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          scope?: Database["public"]["Enums"]["offer_scope"]
          shop_id?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      onesignal_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          player_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          player_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          player_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event_type: string
          from_value: string | null
          id: string
          meta: Json
          order_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type: string
          from_value?: string | null
          id?: string
          meta?: Json
          order_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: string
          meta?: Json
          order_id?: string
          to_value?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          child_order_id: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          shop_id: string | null
          shop_product_id: string | null
          unit: string | null
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          child_order_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          order_id: string
          price: number
          product_id?: string | null
          quantity: number
          shop_id?: string | null
          shop_product_id?: string | null
          unit?: string | null
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          child_order_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          shop_id?: string | null
          shop_product_id?: string | null
          unit?: string | null
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_product_id_fkey"
            columns: ["shop_product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_routing_log: {
        Row: {
          candidates_considered: number
          chosen_distance_km: number | null
          chosen_shop_id: string | null
          created_at: string
          delivery_lat: number | null
          delivery_lng: number | null
          details: Json
          id: string
          order_id: string | null
          outcome: string
          pincode: string | null
          reason: string | null
        }
        Insert: {
          candidates_considered?: number
          chosen_distance_km?: number | null
          chosen_shop_id?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          details?: Json
          id?: string
          order_id?: string | null
          outcome: string
          pincode?: string | null
          reason?: string | null
        }
        Update: {
          candidates_considered?: number
          chosen_distance_km?: number | null
          chosen_shop_id?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          details?: Json
          id?: string
          order_id?: string | null
          outcome?: string
          pincode?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_routing_log_chosen_shop_id_fkey"
            columns: ["chosen_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_routing_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: Json
          assignment_attempts: number
          assignment_distance_km: number | null
          assignment_expires_at: string | null
          assignment_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          coupon_code: string | null
          current_pickup_index: number
          delivery_fee: number
          delivery_instruction: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_pincode: string | null
          delivery_type: string
          discount: number
          fast_delivery_fee: number
          handling_fee: number
          id: string
          is_parent: boolean
          order_number: string
          paid_at: string | null
          parent_order_id: string | null
          partner_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_otp: string | null
          pickup_route_computed_at: string | null
          pickup_sequence: Json | null
          pickup_verified_at: string | null
          placed_at: string
          prep_time_minutes: number | null
          ready_for_pickup_at: string | null
          rejected_shop_ids: string[]
          routing_status: string | null
          shop_count: number
          shop_id: string | null
          shop_selection_mode: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: Json
          assignment_attempts?: number
          assignment_distance_km?: number | null
          assignment_expires_at?: string | null
          assignment_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code?: string | null
          current_pickup_index?: number
          delivery_fee?: number
          delivery_instruction?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_pincode?: string | null
          delivery_type?: string
          discount?: number
          fast_delivery_fee?: number
          handling_fee?: number
          id?: string
          is_parent?: boolean
          order_number?: string
          paid_at?: string | null
          parent_order_id?: string | null
          partner_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_otp?: string | null
          pickup_route_computed_at?: string | null
          pickup_sequence?: Json | null
          pickup_verified_at?: string | null
          placed_at?: string
          prep_time_minutes?: number | null
          ready_for_pickup_at?: string | null
          rejected_shop_ids?: string[]
          routing_status?: string | null
          shop_count?: number
          shop_id?: string | null
          shop_selection_mode?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax?: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: Json
          assignment_attempts?: number
          assignment_distance_km?: number | null
          assignment_expires_at?: string | null
          assignment_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code?: string | null
          current_pickup_index?: number
          delivery_fee?: number
          delivery_instruction?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_pincode?: string | null
          delivery_type?: string
          discount?: number
          fast_delivery_fee?: number
          handling_fee?: number
          id?: string
          is_parent?: boolean
          order_number?: string
          paid_at?: string | null
          parent_order_id?: string | null
          partner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_otp?: string | null
          pickup_route_computed_at?: string | null
          pickup_sequence?: Json | null
          pickup_verified_at?: string | null
          placed_at?: string
          prep_time_minutes?: number | null
          ready_for_pickup_at?: string | null
          rejected_shop_ids?: string[]
          routing_status?: string | null
          shop_count?: number
          shop_id?: string | null
          shop_selection_mode?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_attendance: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          partner_id: string
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id: string
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          refund_amount: number | null
          refund_id: string | null
          refunded_at: string | null
          signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id: string
          provider: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refunded_at?: string | null
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refunded_at?: string | null
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_events: {
        Row: {
          actor_user_id: string | null
          child_order_id: string | null
          created_at: string
          detail: Json | null
          event: string
          id: string
          parent_order_id: string
          shop_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          child_order_id?: string | null
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          parent_order_id: string
          shop_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          child_order_id?: string | null
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          parent_order_id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_events_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_events_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          created_at: string
          product_id: string
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          subcategory_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_subcategories_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          display_order: number
          id: string
          images: string[]
          is_available: boolean
          is_default: boolean
          mrp: number
          name: string | null
          product_id: string
          retail_price: number
          selling_price: number
          size: string
          sku: string | null
          stock: number
          unit: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          display_order?: number
          id?: string
          images?: string[]
          is_available?: boolean
          is_default?: boolean
          mrp?: number
          name?: string | null
          product_id: string
          retail_price?: number
          selling_price?: number
          size: string
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          display_order?: number
          id?: string
          images?: string[]
          is_available?: boolean
          is_default?: boolean
          mrp?: number
          name?: string | null
          product_id?: string
          retail_price?: number
          selling_price?: number
          size?: string
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          cover_image: string | null
          created_at: string
          delivery_minutes: number
          description: string | null
          id: string
          image_gallery: string[]
          image_url: string | null
          is_available: boolean
          is_bestseller: boolean
          is_featured: boolean
          mrp: number
          name: string
          name_normalized: string | null
          price: number
          rating: number
          slug: string
          stock: number
          subcategory_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          delivery_minutes?: number
          description?: string | null
          id?: string
          image_gallery?: string[]
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          mrp: number
          name: string
          name_normalized?: string | null
          price: number
          rating?: number
          slug: string
          stock?: number
          subcategory_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          delivery_minutes?: number
          description?: string | null
          id?: string
          image_gallery?: string[]
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          mrp?: number
          name?: string
          name_normalized?: string | null
          price?: number
          rating?: number
          slug?: string
          stock?: number
          subcategory_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          pincode: string | null
          shop_id: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          pincode?: string | null
          shop_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          pincode?: string | null
          shop_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_requests: {
        Row: {
          created_at: string
          data: Json
          decided_at: string | null
          decided_by: string | null
          id: string
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          rejection_reason?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          detail: Json
          event_type: string
          id: string
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      shop_assignment_history: {
        Row: {
          assigned_at: string
          attempt_number: number
          created_at: string
          id: string
          order_id: string
          reason: string | null
          responded_at: string | null
          shop_id: string | null
          status: string
        }
        Insert: {
          assigned_at?: string
          attempt_number?: number
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
          responded_at?: string | null
          shop_id?: string | null
          status: string
        }
        Update: {
          assigned_at?: string
          attempt_number?: number
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
          responded_at?: string | null
          shop_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_assignment_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_assignment_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          name: string
          shop_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          shop_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_category_items: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_category_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "shop_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_collections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_delivery_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          delivery_partner_id: string
          id: string
          shop_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          delivery_partner_id: string
          id?: string
          shop_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          delivery_partner_id?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_delivery_assignments_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_delivery_assignments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          barcode: string | null
          created_at: string
          expiry_date: string | null
          id: string
          images: string[]
          initial_stock: number | null
          is_available: boolean
          manufacturing_date: string | null
          mrp: number | null
          price: number
          product_id: string
          retail_price: number | null
          shop_id: string
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          images?: string[]
          initial_stock?: number | null
          is_available?: boolean
          manufacturing_date?: string | null
          mrp?: number | null
          price: number
          product_id: string
          retail_price?: number | null
          shop_id: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          images?: string[]
          initial_stock?: number | null
          is_available?: boolean
          manufacturing_date?: string | null
          mrp?: number | null
          price?: number
          product_id?: string
          retail_price?: number | null
          shop_id?: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_open: boolean
          latitude: number
          logo_url: string | null
          longitude: number
          name: string
          owner_id: string | null
          phone: string | null
          pincode: string
          service_radius_km: number
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_open?: boolean
          latitude: number
          logo_url?: string | null
          longitude: number
          name: string
          owner_id?: string | null
          phone?: string | null
          pincode: string
          service_radius_km?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_open?: boolean
          latitude?: number
          logo_url?: string | null
          longitude?: number
          name?: string
          owner_id?: string | null
          phone?: string | null
          pincode?: string
          service_radius_km?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_agents: {
        Row: {
          created_at: string
          display_name: string | null
          is_active: boolean
          max_concurrent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          max_concurrent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          max_concurrent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          created_at: string
          description: string
          first_response_at: string | null
          id: string
          order_id: string | null
          partner_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          role_at_creation: string
          shop_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          description: string
          first_response_at?: string | null
          id?: string
          order_id?: string | null
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          role_at_creation: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          description?: string
          first_response_at?: string | null
          id?: string
          order_id?: string | null
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          role_at_creation?: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_to: string
          id: string
          ticket_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to: string
          id?: string
          ticket_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string
          id?: string
          ticket_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          message_id: string | null
          mime: string | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          mime?: string | null
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          mime?: string | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_deletion_check: { Args: never; Returns: Json }
      actor_role_label: { Args: never; Returns: string }
      add_to_cart: {
        Args: {
          p_product_id: string
          p_qty?: number
          p_shop_id?: string
          p_variant_id?: string
        }
        Returns: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          shop_id: string | null
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cart_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_approve_delivery_request: {
        Args: {
          _name?: string
          _phone?: string
          _request_id: string
          _shop_id: string
          _vehicle?: string
        }
        Returns: string
      }
      admin_approve_shopkeeper_request: {
        Args: {
          _address?: string
          _city?: string
          _lat?: number
          _lng?: number
          _phone?: string
          _pincode?: string
          _radius?: number
          _request_id: string
          _shop_id?: string
          _shop_name?: string
        }
        Returns: string
      }
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_assign_shop_owner: {
        Args: { _shop_id: string; _user_email: string }
        Returns: string
      }
      admin_create_delivery_partner: {
        Args: {
          _name: string
          _phone: string
          _user_email?: string
          _vehicle?: string
        }
        Returns: string
      }
      admin_create_shopkeeper: {
        Args: {
          _address: string
          _city: string
          _lat: number
          _lng: number
          _phone?: string
          _pincode: string
          _radius?: number
          _shop_name: string
          _user_email: string
        }
        Returns: string
      }
      admin_delete_delivery_zone: { Args: { _id: string }; Returns: undefined }
      admin_delete_shop: { Args: { _shop_id: string }; Returns: undefined }
      admin_duplicate_delivery_zone: {
        Args: { _id: string; _new_pin: string }
        Returns: {
          city: string
          created_at: string
          default_handling_fee: number
          delivery_radius_km: number
          express_enabled: boolean
          express_eta_minutes: string
          express_fee: number
          express_handling_fee: number | null
          fast_enabled: boolean
          fast_eta_minutes: string
          fast_fee: number
          fast_handling_fee: number | null
          free_handling_above: number | null
          handling_enabled: boolean
          handling_percentage: number
          handling_type: string
          id: string
          is_active: boolean
          minimum_order_express: number | null
          minimum_order_fast: number | null
          minimum_order_standard: number | null
          pin_code: string
          standard_enabled: boolean
          standard_eta_minutes: string
          standard_fee: number
          standard_handling_fee: number | null
          state: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "delivery_zone_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_complaints: {
        Args: never
        Returns: {
          address_line: string
          category: string
          city: string
          created_at: string
          description: string
          full_name: string
          id: string
          phone: string
          pincode: string
          role_at_creation: string
          shop_address: string
          shop_name: string
          shop_phone: string
          status: string
          ticket_number: string
          title: string
          user_id: string
        }[]
      }
      admin_list_delivery_zones: {
        Args: never
        Returns: {
          city: string
          created_at: string
          default_handling_fee: number
          delivery_radius_km: number
          express_enabled: boolean
          express_eta_minutes: string
          express_fee: number
          express_handling_fee: number | null
          fast_enabled: boolean
          fast_eta_minutes: string
          fast_fee: number
          fast_handling_fee: number | null
          free_handling_above: number | null
          handling_enabled: boolean
          handling_percentage: number
          handling_type: string
          id: string
          is_active: boolean
          minimum_order_express: number | null
          minimum_order_fast: number | null
          minimum_order_standard: number | null
          pin_code: string
          standard_enabled: boolean
          standard_eta_minutes: string
          standard_fee: number
          standard_handling_fee: number | null
          state: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "delivery_zone_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_payments: {
        Args: {
          _limit?: number
          _status?: Database["public"]["Enums"]["payment_status"]
        }
        Returns: {
          amount: number
          created_at: string
          error_code: string
          error_description: string
          id: string
          method: string
          order_id: string
          provider: string
          provider_payment_id: string
          refund_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }[]
      }
      admin_list_role_requests: {
        Args: { _status?: string }
        Returns: {
          data: Json
          decided_at: string
          email: string
          full_name: string
          id: string
          phone: string
          rejection_reason: string
          requested_role: Database["public"]["Enums"]["app_role"]
          status: string
          submitted_at: string
          user_id: string
        }[]
      }
      admin_list_shops: {
        Args: never
        Returns: {
          acceptance_rate: number
          address: string
          avg_rating: number
          city: string
          created_at: string
          id: string
          is_open: boolean
          latitude: number
          logo_url: string
          longitude: number
          monthly_revenue: number
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          owner_phone: string
          owner_status: string
          phone: string
          pincode: string
          service_radius_km: number
          state: string
          status: string
          today_orders: number
          total_orders: number
          updated_at: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          address: string
          created_at: string
          email: string
          full_name: string
          id: string
          pending_request_count: number
          phone: string
          roles: Database["public"]["Enums"]["app_role"][]
          status: string
        }[]
      }
      admin_live_partners: {
        Args: never
        Returns: {
          active_order_count: number
          availability_status: string
          current_order_id: string
          current_order_number: string
          eta_minutes: number
          is_online: boolean
          name: string
          partner_id: string
          phone: string
          rating: number
          shop_id: string
          shop_name: string
          status_updated_at: string
          vehicle: string
        }[]
      }
      admin_order_timeline: {
        Args: { _parent_id: string }
        Returns: {
          actor: string
          at: string
          detail: Json
          event: string
        }[]
      }
      admin_partner_performance: {
        Args: never
        Returns: {
          avg_minutes_30d: number
          hours_today: number
          is_online: boolean
          name: string
          on_time_pct_30d: number
          orders_30d: number
          orders_7d: number
          orders_today: number
          partner_id: string
          phone: string
          rating: number
        }[]
      }
      admin_payments_summary: { Args: never; Returns: Json }
      admin_reassign_partner: {
        Args: { _order_id: string; _partner_id: string }
        Returns: undefined
      }
      admin_reassign_shop: {
        Args: { _order_id: string; _shop_id: string }
        Returns: undefined
      }
      admin_record_refund: {
        Args: { _amount: number; _payment_id: string; _refund_id: string }
        Returns: undefined
      }
      admin_reject_role_request: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      admin_remove_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_remove_support_agent: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_search_users: {
        Args: { _limit?: number; _q: string }
        Returns: {
          email: string
          full_name: string
          id: string
          phone: string
          status: string
        }[]
      }
      admin_set_shop_status: {
        Args: { _shop_id: string; _status: string }
        Returns: undefined
      }
      admin_set_support_agent: {
        Args: { _is_active?: boolean; _user_email: string }
        Returns: string
      }
      admin_set_user_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      admin_support_stats: { Args: never; Returns: Json }
      admin_transfer_partner: {
        Args: { _partner_id: string; _shop_id: string }
        Returns: undefined
      }
      admin_unassign_shop_owner: { Args: { _shop_id: string }; Returns: string }
      admin_update_order_status: {
        Args: {
          _order_id: string
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      admin_update_shop: {
        Args: {
          _address?: string
          _city?: string
          _is_open?: boolean
          _lat?: number
          _lng?: number
          _logo_url?: string
          _name?: string
          _phone?: string
          _pincode?: string
          _radius?: number
          _shop_id: string
          _state?: string
        }
        Returns: undefined
      }
      admin_upsert_delivery_zone: {
        Args: { _data: Json }
        Returns: {
          city: string
          created_at: string
          default_handling_fee: number
          delivery_radius_km: number
          express_enabled: boolean
          express_eta_minutes: string
          express_fee: number
          express_handling_fee: number | null
          fast_enabled: boolean
          fast_eta_minutes: string
          fast_fee: number
          fast_handling_fee: number | null
          free_handling_above: number | null
          handling_enabled: boolean
          handling_percentage: number
          handling_type: string
          id: string
          is_active: boolean
          minimum_order_express: number | null
          minimum_order_fast: number | null
          minimum_order_standard: number | null
          pin_code: string
          standard_enabled: boolean
          standard_eta_minutes: string
          standard_fee: number
          standard_handling_fee: number | null
          state: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "delivery_zone_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_ticket: {
        Args: { _agent_id: string; _ticket_id: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      category_filter_facets: {
        Args: { _category_id?: string; _pincode?: string }
        Returns: Json
      }
      compute_handling_fee: {
        Args: { _delivery_type: string; _pincode: string; _subtotal: number }
        Returns: number
      }
      count_eligible_shops: {
        Args: { _lat?: number; _lng?: number; _pincode?: string }
        Returns: number
      }
      create_delivery_partner: {
        Args: {
          _name: string
          _phone: string
          _shop_id?: string
          _user_email?: string
          _vehicle?: string
        }
        Returns: string
      }
      create_support_ticket: {
        Args: {
          _category: Database["public"]["Enums"]["ticket_category"]
          _description: string
          _order_id?: string
          _partner_id?: string
          _shop_id?: string
          _title: string
        }
        Returns: string
      }
      current_user_partner_id: { Args: never; Returns: string }
      debug_shop_routing: {
        Args: {
          _lat: number
          _lng: number
          _order_id?: string
          _pincode: string
        }
        Returns: {
          distance_km: number
          eligible: boolean
          has_owner: boolean
          is_open: boolean
          missing_items: number
          pincode_match: boolean
          previously_rejected: boolean
          reason: string
          service_radius_km: number
          shop_id: string
          shop_name: string
          shop_pincode: string
          within_radius: boolean
        }[]
      }
      delete_delivery_partner: {
        Args: { _partner_id: string }
        Returns: undefined
      }
      delete_my_account_data: { Args: never; Returns: Json }
      effective_available_stock: {
        Args: { _shop_product_id: string }
        Returns: number
      }
      find_best_shop_for_cart: {
        Args: {
          _exclude?: string[]
          _lat: number
          _lng: number
          _pincode: string
          _user_id: string
        }
        Returns: string
      }
      find_catalog_duplicate: {
        Args: { _name: string; _shop_id?: string }
        Returns: {
          already_added: boolean
          brand: string
          id: string
          image: string
          name: string
          unit: string
        }[]
      }
      find_nearest_partner_for_order: {
        Args: { _exclude?: string[]; _order_id: string }
        Returns: string
      }
      find_nearest_shop_for_cart: {
        Args: {
          _exclude?: string[]
          _lat: number
          _lng: number
          _user_id: string
        }
        Returns: string
      }
      find_nearest_shop_for_order: {
        Args: { _order_id: string }
        Returns: string
      }
      get_delivery_options_for_pincode: {
        Args: { _pincode: string }
        Returns: {
          city: string
          default_handling_fee: number
          express_enabled: boolean
          express_eta_minutes: string
          express_fee: number
          express_handling_fee: number
          fast_enabled: boolean
          fast_eta_minutes: string
          fast_fee: number
          fast_handling_fee: number
          free_handling_above: number
          handling_enabled: boolean
          handling_percentage: number
          handling_type: string
          is_active: boolean
          minimum_order_express: number
          minimum_order_fast: number
          minimum_order_standard: number
          pin_code: string
          standard_enabled: boolean
          standard_eta_minutes: string
          standard_fee: number
          standard_handling_fee: number
          state: string
        }[]
      }
      get_order_partner_tracking: {
        Args: { _order_id: string }
        Returns: {
          availability_status: string
          current_lat: number
          current_lng: number
          eta_minutes: number
          id: string
          name: string
          rating: number
          status_updated_at: string
          vehicle: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      list_category_products:
        | {
            Args: {
              _brands?: string[]
              _category_id?: string
              _limit?: number
              _max_price?: number
              _min_discount?: number
              _min_price?: number
              _min_rating?: number
              _pincode?: string
              _search?: string
              _sizes?: string[]
              _sort?: string
              _subcategory_id?: string
              _subcategory_ids?: string[]
            }
            Returns: {
              brand: string
              category_id: string
              delivery_minutes: number
              id: string
              image_url: string
              mrp: number
              name: string
              price: number
              rating: number
              slug: string
              stock: number
              subcategory_id: string
              unit: string
            }[]
          }
        | {
            Args: {
              _brands?: string[]
              _category_id?: string
              _delivery?: string[]
              _limit?: number
              _max_price?: number
              _min_discount?: number
              _min_price?: number
              _min_rating?: number
              _pincode?: string
              _search?: string
              _sizes?: string[]
              _sort?: string
              _subcategory_id?: string
              _subcategory_ids?: string[]
            }
            Returns: {
              brand: string
              category_id: string
              delivery_minutes: number
              id: string
              image_url: string
              mrp: number
              name: string
              price: number
              rating: number
              slug: string
              stock: number
              subcategory_id: string
              unit: string
            }[]
          }
      list_category_subcategories: {
        Args: { _category_id: string; _pincode?: string }
        Returns: {
          display_order: number
          icon: string
          id: string
          image_url: string
          name: string
          product_count: number
          slug: string
        }[]
      }
      list_customer_products: {
        Args: {
          _category_id?: string
          _ids?: string[]
          _limit?: number
          _only_bestseller?: boolean
          _only_featured?: boolean
          _pincode: string
          _search?: string
          _sort?: string
        }
        Returns: {
          category_id: string
          delivery_minutes: number
          id: string
          image_url: string
          mrp: number
          name: string
          price: number
          rating: number
          slug: string
          stock: number
          unit: string
        }[]
      }
      list_eligible_shops_for_cart: {
        Args: { _lat?: number; _lng?: number; _pincode?: string }
        Returns: {
          delivery_minutes: number
          distance_km: number
          latitude: number
          longitude: number
          mrp: number
          pincode: string
          price: number
          service_radius_km: number
          shop_address: string
          shop_id: string
          shop_name: string
          stock: number
        }[]
      }
      list_eligible_shops_for_product: {
        Args: {
          _lat?: number
          _lng?: number
          _pincode?: string
          _product_id: string
          _variant_id?: string
        }
        Returns: {
          delivery_minutes: number
          distance_km: number
          latitude: number
          longitude: number
          mrp: number
          pincode: string
          price: number
          service_radius_km: number
          shop_address: string
          shop_id: string
          shop_name: string
          stock: number
        }[]
      }
      log_security_event: {
        Args: { _detail?: Json; _event_type: string; _target_user_id: string }
        Returns: undefined
      }
      master_catalog_brands: {
        Args: never
        Returns: {
          brand: string
        }[]
      }
      normalize_product_name: { Args: { _name: string }; Returns: string }
      notify_expiring_products: { Args: never; Returns: undefined }
      notify_role: {
        Args: {
          _body: string
          _category?: string
          _data?: Json
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
        }
        Returns: number
      }
      notify_user: {
        Args: {
          _body: string
          _category?: string
          _data?: Json
          _title: string
          _user_id: string
        }
        Returns: string
      }
      partner_accept_order: { Args: { _order_id: string }; Returns: undefined }
      partner_accept_parent: {
        Args: { _parent_id: string }
        Returns: undefined
      }
      partner_available_orders: {
        Args: never
        Returns: {
          area_pincode: string
          city: string
          delivery_type: string
          fast_delivery_fee: number
          id: string
          item_count: number
          order_number: string
          placed_at: string
          shop_name: string
          total: number
        }[]
      }
      partner_available_parent_orders: {
        Args: never
        Returns: {
          city: string
          delivery_type: string
          fast_delivery_fee: number
          first_pickup_lat: number
          first_pickup_lng: number
          items_count: number
          order_number: string
          parent_id: string
          pincode: string
          ready_at: string
          shop_count: number
          total: number
        }[]
      }
      partner_check_in: { Args: never; Returns: string }
      partner_check_out: { Args: never; Returns: undefined }
      partner_decline_assignment: {
        Args: { _order_id: string }
        Returns: undefined
      }
      partner_is_on_order: { Args: { _partner_id: string }; Returns: boolean }
      partner_mark_delivered: {
        Args: { _order_id: string }
        Returns: undefined
      }
      partner_parent_pickup_stops: {
        Args: { _parent_id: string }
        Returns: {
          child_id: string
          items_count: number
          pickup_verified_at: string
          seq: number
          shop_address: string
          shop_id: string
          shop_lat: number
          shop_lng: number
          shop_name: string
          shop_phone: string
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      partner_send_eta_update: {
        Args: {
          _custom_message?: string
          _eta_minutes?: number
          _kind: string
          _order_id: string
        }
        Returns: string
      }
      partner_send_message: {
        Args: { _custom_message?: string; _kind: string; _order_id: string }
        Returns: string
      }
      partner_today_hours: { Args: { _partner_id: string }; Returns: number }
      partner_update_location: {
        Args: { _lat: number; _lng: number }
        Returns: undefined
      }
      partner_update_status: {
        Args: { _eta_minutes?: number; _order_id?: string; _status: string }
        Returns: undefined
      }
      place_multi_shop_order: {
        Args: {
          _address: Json
          _coupon_code?: string
          _delivery_instruction?: string
          _delivery_type?: string
          _lat?: number
          _lng?: number
          _payment_method: string
          _pincode?: string
        }
        Returns: {
          order_number: string
          parent_order_id: string
          shop_count: number
          total: number
        }[]
      }
      place_order: {
        Args: {
          _address: Json
          _coupon_code?: string
          _delivery_instruction?: string
          _delivery_type?: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      plan_multi_shop_cart: {
        Args: { _lat: number; _lng: number; _pincode: string; _user: string }
        Returns: {
          distance_km: number
          image_url: string
          price: number
          product_id: string
          product_name: string
          quantity: number
          shop_id: string
          shop_name: string
          shop_product_id: string
          unit: string
          variant_id: string
        }[]
      }
      post_ticket_message: {
        Args: { _body: string; _is_internal?: boolean; _ticket_id: string }
        Returns: string
      }
      product_shop_availability: {
        Args: {
          _lat?: number
          _lng?: number
          _pincode?: string
          _product_id: string
          _variant_id?: string
        }
        Returns: {
          closed_shops: number
          open_shops: number
        }[]
      }
      purge_old_notifications: { Args: never; Returns: undefined }
      rank_riders_for_parent: {
        Args: { _limit?: number; _parent_id: string }
        Returns: {
          active_order_count: number
          distance_km: number
          partner_id: string
          rating: number
          score: number
          user_id: string
        }[]
      }
      reassign_orders_from_closed_shop: {
        Args: { _shop_id: string }
        Returns: number
      }
      reassign_stale_orders: { Args: never; Returns: number }
      release_expired_reservations: { Args: never; Returns: number }
      restore_order_stock: { Args: { _order_id: string }; Returns: undefined }
      rider_verify_pickup: {
        Args: { _child_id: string; _otp: string }
        Returns: undefined
      }
      search_master_catalog: {
        Args: {
          _brand?: string
          _category_id?: string
          _limit?: number
          _offset?: number
          _q?: string
          _shop_id?: string
        }
        Returns: {
          already_added: boolean
          brand: string
          category_names: string[]
          id: string
          image: string
          mrp: number
          name: string
          price: number
          total_count: number
          unit: string
        }[]
      }
      send_fcm_push: { Args: { _notification_id: string }; Returns: undefined }
      send_onesignal_push: {
        Args: { _notification_id: string }
        Returns: undefined
      }
      shop_accept_child: {
        Args: { _child_id: string; _prep_minutes?: number }
        Returns: undefined
      }
      shop_accept_order: { Args: { _order_id: string }; Returns: undefined }
      shop_assign_partner: {
        Args: { _order_id: string; _partner_id: string }
        Returns: undefined
      }
      shop_available_partners: {
        Args: { _shop_id: string }
        Returns: {
          is_online: boolean
          name: string
          on_team: boolean
          partner_id: string
          phone: string
          rating: number
          vehicle: string
        }[]
      }
      shop_list_team: {
        Args: { _shop_id: string }
        Returns: {
          active_order_count: number
          availability_status: string
          is_online: boolean
          name: string
          partner_id: string
          phone: string
          rating: number
          vehicle: string
        }[]
      }
      shop_live_team: {
        Args: { _shop_id: string }
        Returns: {
          active_order_count: number
          availability_status: string
          current_order_id: string
          current_order_number: string
          eta_minutes: number
          is_online: boolean
          name: string
          partner_id: string
          phone: string
          rating: number
          status_updated_at: string
          vehicle: string
        }[]
      }
      shop_mark_child_ready: { Args: { _child_id: string }; Returns: undefined }
      shop_mark_collected: { Args: { _order_id: string }; Returns: undefined }
      shop_mark_packed: { Args: { _order_id: string }; Returns: undefined }
      shop_partner_performance: {
        Args: { _shop_id: string }
        Returns: {
          avg_minutes_today: number
          hours_today: number
          is_online: boolean
          name: string
          on_time_pct: number
          orders_7d: number
          orders_today: number
          partner_id: string
          phone: string
          rating: number
        }[]
      }
      shop_reject_child: {
        Args: { _child_id: string; _reason?: string }
        Returns: Json
      }
      shop_reject_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      shop_set_team: {
        Args: { _partner_ids: string[]; _shop_id: string }
        Returns: undefined
      }
      submit_role_request: {
        Args: { _data: Json; _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      support_list_complaints: {
        Args: never
        Returns: {
          address_line: string
          assigned_to: string
          category: string
          city: string
          created_at: string
          description: string
          full_name: string
          id: string
          phone: string
          pincode: string
          role_at_creation: string
          shop_address: string
          shop_name: string
          shop_phone: string
          status: string
          ticket_number: string
          title: string
          user_id: string
        }[]
      }
      support_ticket_context: { Args: { _ticket_id: string }; Returns: Json }
      update_ticket_status:
        | {
            Args: {
              _status: Database["public"]["Enums"]["ticket_status"]
              _ticket_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _notes?: string
              _status: Database["public"]["Enums"]["ticket_status"]
              _ticket_id: string
            }
            Returns: undefined
          }
      user_owns_shop_for_order: {
        Args: { _order_id: string }
        Returns: boolean
      }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: {
          code: string
          description: string
          discount: number
        }[]
      }
    }
    Enums: {
      address_type: "home" | "work" | "other"
      app_role:
        | "admin"
        | "customer"
        | "shopkeeper"
        | "delivery"
        | "support"
        | "super_admin"
      coupon_type: "percent" | "flat"
      offer_scope: "global" | "shop"
      order_status:
        | "placed"
        | "payment_confirmed"
        | "packing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "awaiting_shop"
        | "accepted_by_shop"
        | "packed"
        | "no_shop_available"
      payment_method: "razorpay" | "cod"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refund_initiated"
        | "refunded"
        | "cod"
      ticket_category:
        | "order_issue"
        | "payment_issue"
        | "refund_issue"
        | "delivery_issue"
        | "product_issue"
        | "shop_issue"
        | "account_issue"
        | "technical_issue"
      ticket_priority: "low" | "normal" | "high"
      ticket_status: "open" | "assigned" | "in_progress" | "resolved" | "closed"
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

export const Constants = {
  public: {
    Enums: {
      address_type: ["home", "work", "other"],
      app_role: [
        "admin",
        "customer",
        "shopkeeper",
        "delivery",
        "support",
        "super_admin",
      ],
      coupon_type: ["percent", "flat"],
      offer_scope: ["global", "shop"],
      order_status: [
        "placed",
        "payment_confirmed",
        "packing",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "awaiting_shop",
        "accepted_by_shop",
        "packed",
        "no_shop_available",
      ],
      payment_method: ["razorpay", "cod"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refund_initiated",
        "refunded",
        "cod",
      ],
      ticket_category: [
        "order_issue",
        "payment_issue",
        "refund_issue",
        "delivery_issue",
        "product_issue",
        "shop_issue",
        "account_issue",
        "technical_issue",
      ],
      ticket_priority: ["low", "normal", "high"],
      ticket_status: ["open", "assigned", "in_progress", "resolved", "closed"],
    },
  },
} as const
