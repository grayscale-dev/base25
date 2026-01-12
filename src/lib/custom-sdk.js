import { supabase } from "./supabase-client.js";
import { createClient } from "@supabase/supabase-js";

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
};

// Create service role client for admin operations (bypasses RLS)
const supabaseUrl = getEnvVar("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
const supabaseServiceKey = getEnvVar(
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

const INTERACTIONS_ENDPOINT = getEnvVar(
  "VITE_INTERACTIONS_ENDPOINT",
  "/api/interactions"
);

const BILLABLE_INTERACTIONS = {
  feedback: { service: "feedback", create: "create_post" },
  feedback_responses: { service: "feedback", create: "create_comment" },
  roadmap_items: { service: "roadmap", create: "create_item" },
  roadmap_updates: { service: "roadmap", create: "create_update" },
  changelog_entries: { service: "changelog", create: "create_entry" },
  doc_pages: { service: "docs", create: "create_page", update: "edit_page" },
  doc_comments: { service: "docs", create: "create_comment" },
  support_threads: { service: "support", create: "create_ticket" },
  support_messages: { service: "support", create: "send_message" },
};

async function recordInteraction(payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return;

  const body = JSON.stringify(payload);

  try {
    const response = await fetch(INTERACTIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Interaction tracking failed: ${response.status}`);
    }
  } catch (error) {
    try {
      await supabase.functions.invoke("recordInteraction", {
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (fallbackError) {
      console.warn("Interaction tracking failed:", fallbackError || error);
    }
  }
}

async function trackInteraction(operation, tableName, record, data, useServiceRole) {
  if (useServiceRole) return;
  const config = BILLABLE_INTERACTIONS[tableName];
  if (!config) return;
  const eventType = config[operation];
  if (!eventType) return;

  const boardId =
    record?.board_id ||
    data?.board_id ||
    record?.workspace_id ||
    data?.workspace_id;

  if (!boardId) return;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) return;

  const timestamp =
    record?.created_at ||
    record?.updated_at ||
    new Date().toISOString();

  const idempotencyKey = record?.id
    ? `${tableName}:${record.id}:${eventType}`
    : null;

  await recordInteraction({
    workspace_id: boardId,
    service: config.service,
    event_type: eventType,
    timestamp,
    actor_user_id: userData.user.id,
    idempotency_key: idempotencyKey,
  });
}


/**
 * Base Entity class that provides CRUD operations compatible with Base44 SDK
 */
export class CustomEntity {
  constructor(tableName, useServiceRole = false) {
    this.tableName = tableName;
    this.supabase = useServiceRole ? supabaseAdmin : supabase;
    this.useServiceRole = useServiceRole;
  }

  /**
   * Map Base44 field names to Supabase field names
   * @param {string} field - Field name to map
   * @returns {string} Mapped field name
   */
  mapFieldName(field) {
    const fieldMappings = {
      created_date: "created_at",
      updated_date: "updated_at",
      // Add any other field mappings as needed
    };
    return fieldMappings[field] || field;
  }

  /**
   * Map data object fields from Base44 to Supabase format
   * @param {Object} data - Data object to map
   * @returns {Object} Mapped data object
   */
  mapDataFields(data) {
    if (!data || typeof data !== "object") return data;

    const mapped = {};
    Object.entries(data).forEach(([key, value]) => {
      const mappedKey = this.mapFieldName(key);
      mapped[mappedKey] = value;
    });
    return mapped;
  }

  /**
   * Map Supabase field names back to Base44 field names in results
   * @param {Array|Object} data - Data to map
   * @returns {Array|Object} Mapped data
   */
  mapResultFields(data) {
    if (!data) return data;

    const reverseFieldMappings = {
      created_at: "created_date",
      updated_at: "updated_date",
    };

    const mapObject = (obj) => {
      const mapped = {};
      for (const [key, value] of Object.entries(obj)) {
        const mappedKey = reverseFieldMappings[key] || key;
        mapped[mappedKey] = value;
      }
      return mapped;
    };

    if (Array.isArray(data)) {
      return data.map(mapObject);
    } else {
      return mapObject(data);
    }
  }

  /**
   * List all records with optional ordering and limit
   * @param {string} orderBy - Field to order by (prefix with '-' for descending)
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} Array of records
   */
  async list(orderBy = "created_at", limit = null) {
    let query = this.supabase.from(this.tableName).select("*");

    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`
        );
        return [];
      }
      throw error;
    }
    return this.mapResultFields(data) || [];
  }

  /**
   * Filter records based on conditions
   * @param {Object} conditions - Filter conditions
   * @param {string} orderBy - Field to order by (prefix with '-' for descending)
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} Array of filtered records
   */
  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    let query = this.supabase.from(this.tableName).select("*");

    // Apply filter conditions with field mapping
    Object.entries(conditions).forEach(([key, value]) => {
      const mappedKey = this.mapFieldName(key);
      if (Array.isArray(value)) {
        query = query.in(mappedKey, value);
      } else {
        query = query.eq(mappedKey, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`
        );
        return [];
      }
      console.error(`Filter error for ${this.tableName}:`, error);
      throw error;
    }
    return this.mapResultFields(data) || [];
  }

  /**
   * Get a single record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Single record
   */
  async get(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(`Table ${this.tableName} does not exist, returning null`);
        return null;
      }
      console.error(`Get error for ${this.tableName}:`, error);
      throw error;
    }

    return data ? this.mapResultFields(data) : null;
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  async create(data) {
    // Map field names from Base44 to Supabase format
    const mappedData = this.mapDataFields(data);

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(mappedData)
      .select()
      .single();

    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, cannot create record`
        );
        throw new Error(
          `Table ${this.tableName} is not available in this environment`
        );
      }
      console.error(`Create error for ${this.tableName}:`, error);
      throw error;
    }
    await trackInteraction(
      "create",
      this.tableName,
      result,
      mappedData,
      this.useServiceRole
    );
    return this.mapResultFields(result);
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated record
   */
  async update(id, data) {
    // Map field names from Base44 to Supabase format
    const mappedData = this.mapDataFields(data);

    // Always add updated_at timestamp
    mappedData.updated_at = new Date().toISOString();

    // Update the record
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(mappedData)
      .eq("id", id)
      .select()
      .maybeSingle(); // Use maybeSingle instead of single to handle no rows gracefully

    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, cannot update record`
        );
        return null;
      }
      console.error(`Update error for ${this.tableName}:`, error);
      throw error;
    }

    // If no rows were updated, return null to match Base44 behavior
    if (!result) {
      return null;
    }

    await trackInteraction(
      "update",
      this.tableName,
      result,
      mappedData,
      this.useServiceRole
    );
    return this.mapResultFields(result);
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      // Handle missing table gracefully for legacy entities
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, cannot delete record`
        );
        return;
      }
      throw error;
    }
  }
}

/**
 * User Entity with authentication methods
 */
export class UserEntity extends CustomEntity {
  constructor() {
    super("users", true); // Use service role for user operations to bypass RLS when needed
  }

  mapAuthUser(user) {
    return {
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "",
      profile_photo_url: user.user_metadata?.profile_photo_url || null,
      role: user.user_metadata?.role || "user",
      created_date: user.created_at,
      updated_date: user.updated_at,
    };
  }

  async get(id) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Not authenticated");
    }

    if (user.id !== id) {
      return null;
    }

    return this.mapAuthUser(user);
  }

  /**
   * Get current authenticated user data
   * @returns {Promise<Object>} Current user data
   */
  async me() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        if (!authError.message?.includes("Auth session missing")) {
          console.error("Auth error:", authError);
        }
        throw new Error("Not authenticated");
      }

      if (!user) throw new Error("Not authenticated");
      return this.mapAuthUser(user);
    } catch (error) {
      // Handle various auth-related errors gracefully
      if (
        error.message?.includes("403") ||
        error.message?.includes("Forbidden") ||
        error.message?.includes("User from sub claim in JWT does not exist") ||
        error.message?.includes("AuthApiError")
      ) {
        // Clear any invalid session
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignore sign out errors
        }
        throw new Error("Not authenticated");
      }
      throw error;
    }
  }

  /**
   * Update current user's data
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Updated user data
   */
  async updateMyUserData(userData) {
    const { error } = await supabase.auth.updateUser({
      data: userData,
    });

    if (error) {
      console.error("Error updating user:", error);
      throw error;
    }

    return this.me();
  }

  async updateMe(userData) {
    return this.updateMyUserData(userData);
  }

  /**
   * Sign in with OAuth provider or development mode
   * @param {string} provider - OAuth provider (google, github, etc.) or 'dev' for development
   * @returns {Promise<void>}
   */
  async login(provider = "dev") {
    // For local development, use a simple email/password flow
    if (provider === "dev") {
      // Create a development user if it doesn't exist
      const devEmail = "dev@localhost.com";
      const devPassword = "dev123456";

      try {
        // Try to sign in first using regular supabase client
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (signInError) {
          const message = signInError.message || "";

          if (message.includes("Email not confirmed")) {
            throw new Error(
              "Email not confirmed. Disable email confirmations in Supabase Auth or confirm the dev user."
            );
          }

          if (!message.includes("Invalid login credentials")) {
            console.log("Sign in failed:", message);
            throw signInError;
          }

          console.log(
            "Sign in failed, attempting to create user:",
            signInError.message
          );

          const { data: signUpData, error: signUpError } =
            await supabase.auth.signUp({
              email: devEmail,
              password: devPassword,
              options: {
                data: {
                  full_name: "Development User",
                  role: "admin",
                },
              },
            });

          if (signUpError) {
            console.error("Sign up failed:", signUpError);
            throw new Error(
              signUpError.message ||
                "Sign up failed. Please wait a minute and try again."
            );
          }

          console.log("User created successfully:", signUpData);

          // For local development, we might need to confirm the user manually
          // or the user might be auto-confirmed depending on Supabase settings
          if (signUpData.user && !signUpData.user.email_confirmed_at) {
            console.log(
              "User created but not confirmed. In production, check email for confirmation."
            );
          }

          // Try to sign in again after signup
          const { data: signInAfterSignUpData, error: signInAfterSignUpError } =
            await supabase.auth.signInWithPassword({
              email: devEmail,
              password: devPassword,
            });

          if (signInAfterSignUpError) {
            console.error(
              "Sign in after signup failed:",
              signInAfterSignUpError
            );
            throw signInAfterSignUpError;
          }

          console.log(
            "Successfully signed in after signup:",
            signInAfterSignUpData
          );
        } else {
          console.log("Successfully signed in:", signInData);
        }

        const redirect = localStorage.getItem("post_login_redirect");
        if (redirect) {
          localStorage.removeItem("post_login_redirect");
          window.location.href = redirect;
        } else {
          // Refresh the page to ensure authentication state is properly loaded
          window.location.reload();
        }
      } catch (error) {
        console.error("Development login failed:", error);
        throw error;
      }
      return;
    }

    // For production, use OAuth with regular supabase client
    const redirect = localStorage.getItem("post_login_redirect");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirect || window.location.origin,
      },
    });
    if (error) throw error;
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async logout(redirectTo) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  }

  async redirectToLogin(redirectTo = window.location.href) {
    const provider = getEnvVar("VITE_AUTH_PROVIDER", "dev");
    if (redirectTo) {
      localStorage.setItem("post_login_redirect", redirectTo);
    }
    return this.login(provider);
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        // Clear invalid session if needed
        if (
          authError.message?.includes(
            "User from sub claim in JWT does not exist"
          )
        ) {
          await supabase.auth.signOut();
        }
        return false;
      }

      return !!user;
    } catch {
      return false;
    }
  }

  /**
   * Get current user data if authenticated, null if not
   * @returns {Promise<Object|null>} Current user data or null
   */
  async getCurrentUser() {
    try {
      return await this.me();
    } catch (error) {
      if (error.message === "Not authenticated") {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all users (admin function using service role)
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of users
   */
  async list(orderBy = "created_at", limit = null) {
    console.warn("User listing is not supported without a users table.");
    return [];
  }

  /**
   * Filter users (admin function using service role)
   * @param {Object} conditions - Filter conditions
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of filtered users
   */
  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    console.warn("User filtering is not supported without a users table.");
    return [];
  }
}

/**
 * Convert PascalCase entity name to snake_case table name
 * @param {string} entityName - Entity name in PascalCase
 * @returns {string} Table name in snake_case
 */
const ENTITY_TABLE_MAP = {
  Board: "boards",
  BoardRole: "board_roles",
  BoardAccessRule: "board_access_rules",
  Feedback: "feedback",
  FeedbackResponse: "feedback_responses",
  RoadmapItem: "roadmap_items",
  RoadmapUpdate: "roadmap_updates",
  SupportThread: "support_threads",
  SupportMessage: "support_messages",
  ApiToken: "api_tokens",
  AuditLog: "audit_logs",
  ChangelogEntry: "changelog_entries",
  DocPage: "doc_pages",
  DocComment: "doc_comments",
  DocQueue: "doc_queue",
  WaitlistSignup: "waitlist_signups",
};

function entityNameToTableName(entityName) {
  if (ENTITY_TABLE_MAP[entityName]) {
    return ENTITY_TABLE_MAP[entityName];
  }

  return entityName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Determine if an entity should use service role based on common patterns
 * @param {string} entityName - Entity name
 * @returns {boolean} Whether to use service role
 */
function shouldUseServiceRole(entityName) {
  const serviceRoleEntities = [
    "user",
    "transaction",
    "usermembership",
    "payment",
    "order",
    "subscription",
    "admin",
    "audit",
    "log",
  ];

  return serviceRoleEntities.some((pattern) =>
    entityName.toLowerCase().includes(pattern)
  );
}

/**
 * Create a dynamic entities proxy that creates entities on-demand
 */
function createEntitiesProxy() {
  const entityCache = new Map();

  return new Proxy(
    {},
    {
      get(_, entityName) {
        if (typeof entityName !== "string") return undefined;

        // Return cached entity if it exists
        if (entityCache.has(entityName)) {
          return entityCache.get(entityName);
        }

        // Create new entity on-demand
        const tableName = entityNameToTableName(entityName);
        const useServiceRole = shouldUseServiceRole(entityName);
        const entity = new CustomEntity(tableName, useServiceRole);

        // Cache the entity for future use
        entityCache.set(entityName, entity);

        console.log(
          `Created entity: ${entityName} -> ${tableName} (service role: ${useServiceRole})`
        );

        return entity;
      },

      has(_, entityName) {
        return typeof entityName === "string";
      },

      ownKeys() {
        return Array.from(entityCache.keys());
      },
    }
  );
}

/**
 * Create custom client that mimics Base44 SDK structure
 */
export function createCustomClient() {
  return {
    entities: createEntitiesProxy(),
    auth: new UserEntity(),
    functions: {
      invoke: async (name, payload = {}, options = {}) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const headers = {
          ...options.headers,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        };
        const { data, error } = await supabase.functions.invoke(name, {
          body: payload,
          headers,
        });
        if (error) throw error;
        return { data };
      },
      // Placeholder functions that can be implemented later
      verifyHcaptcha: async () => {
        // TODO: Implement hCaptcha verification
        console.warn("verifyHcaptcha not yet implemented");
        return { success: true };
      },
    },
    appLogs: {
      logUserInApp: async () => {
        return { success: true };
      },
    },
    integrations: {
      Core: {
        InvokeLLM: async ({
          prompt,
          add_context_from_internet = false,
          response_json_schema = null,
          file_urls = null,
        }) => {
          console.warn("InvokeLLM called with:", {
            prompt,
            add_context_from_internet,
            response_json_schema,
            file_urls,
          });

          // TODO: Replace with actual OpenAI API call
          // Example implementation:
          // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          // const response = await openai.chat.completions.create({
          //   model: "gpt-4",
          //   messages: [{ role: "user", content: prompt }],
          //   response_format: response_json_schema ? { type: "json_object" } : undefined
          // });

          if (response_json_schema) {
            return {
              data: {
                message:
                  "This would be structured data matching the provided schema",
                note: "LLM integration not yet implemented",
              },
            };
          } else {
            return {
              response:
                "This would be the LLM response text. LLM integration not yet implemented.",
            };
          }
        },

        SendEmail: async ({
          to,
          subject,
          body,
          from_name = "Peace Adventures",
        }) => {
          console.warn("SendEmail called with:", {
            to,
            subject,
            body,
            from_name,
          });

          // TODO: Replace with actual email service (Resend, SendGrid, etc.)
          // Example with Resend:
          // const resend = new Resend(process.env.RESEND_API_KEY);
          // const result = await resend.emails.send({
          //   from: `${from_name} <noreply@yourdomain.com>`,
          //   to: [to],
          //   subject: subject,
          //   html: body
          // });

          return {
            status: "sent",
            message_id: `mock_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 11)}`,
            note: "Email integration not yet implemented - email would have been sent",
          };
        },

        UploadFile: async ({ file }) => {
          if (!file) {
            throw new Error("No file provided");
          }

          const safeName = (file.name || "file")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 80);
          const fileName = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 10)}_${safeName}`;

          const { error } = await supabase.storage
            .from("uploads")
            .upload(fileName, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });

          if (error) {
            console.error("UploadFile error:", error);
            throw error;
          }

          const { data } = supabase.storage
            .from("uploads")
            .getPublicUrl(fileName);

          return {
            file_url: data.publicUrl,
            path: fileName,
          };
        },

        GenerateImage: async ({ prompt }) => {
          console.warn("GenerateImage called with prompt:", prompt);

          // TODO: Replace with actual AI image generation (DALL-E, Stability AI, etc.)
          // Example with OpenAI DALL-E:
          // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          // const response = await openai.images.generate({
          //   model: "dall-e-3",
          //   prompt: prompt,
          //   size: "1024x1024",
          //   quality: "standard",
          //   n: 1,
          // });
          //
          // return { url: response.data[0].url };

          // Mock response for now
          const mockUrl = `https://mock-ai-images.com/generated/${Date.now()}.png`;
          return {
            url: mockUrl,
            note: "Image generation integration not yet implemented - this is a mock URL",
          };
        },

        ExtractDataFromUploadedFile: async ({ file_url, json_schema }) => {
          console.warn("ExtractDataFromUploadedFile called with:", {
            file_url,
            json_schema,
          });

          // TODO: Replace with actual OCR/document processing service
          // Example with AWS Textract or custom OCR solution:
          // const textract = new AWS.Textract();
          // const result = await textract.analyzeDocument({
          //   Document: { S3Object: { Bucket: bucket, Name: key } },
          //   FeatureTypes: ['TABLES', 'FORMS']
          // }).promise();
          //
          // Process and structure the result according to json_schema

          // Mock response for now
          return {
            status: "success",
            details: null,
            output: json_schema?.type === "array" ? [] : {},
            note: "File data extraction integration not yet implemented - this is a mock response",
          };
        },
      },
    },
  };
}

// Export the default client instance
export const customClient = createCustomClient();
