import { supabase } from "./supabase-client.js";
import { env } from "./env.js";

const isDevEnv = process.env.NODE_ENV === "development";
const supabaseUrl = env.supabaseUrl;

const isNetworkFetchFailure = (error) => {
  const message = error?.message || "";
  return /failed to fetch|fetch failed|networkerror|load failed/i.test(message);
};

const buildSupabaseConnectionError = () =>
  new Error(
    `Unable to reach Supabase Auth at ${supabaseUrl}. Start Supabase locally or configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY with a reachable project.`
  );


/**
 * Base Entity class that provides CRUD operations compatible with Base44 SDK
 */
export class CustomEntity {
  constructor(tableName) {
    this.tableName = tableName;
    this.supabase = supabase;
    this.useServiceRole = false;
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
    super("users");
  }

  mapAuthUser(user) {
    const metadata = user.user_metadata || {};
    const firstName = (metadata.first_name || metadata.given_name || "").trim();
    const lastName = (metadata.last_name || metadata.family_name || "").trim();
    const fallbackFullName = (metadata.full_name || metadata.name || "").trim();
    const resolvedFullName =
      firstName && lastName ? `${firstName} ${lastName}`.trim() : fallbackFullName;

    return {
      id: user.id,
      email: user.email,
      first_name: firstName || "",
      last_name: lastName || "",
      full_name: resolvedFullName,
      profile_photo_url: metadata.profile_photo_url || null,
      role: metadata.role || "user",
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
  async login(provider) {
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
                  first_name: "Development",
                  last_name: "User",
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
        if (isNetworkFetchFailure(error)) {
          throw buildSupabaseConnectionError();
        }
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

  async redirectToLogin(redirectTo = `${window.location.origin}/workspaces`) {
    try {
      let provider = env.authProvider;
      if (!provider) {
        if (isDevEnv) {
          provider = "dev";
        } else {
          throw new Error(
            "NEXT_PUBLIC_AUTH_PROVIDER is not set. Configure an OAuth provider for production."
          );
        }
      }
      if (redirectTo) {
        localStorage.setItem("post_login_redirect", redirectTo);
      }
      await this.login(provider);
      return { ok: true };
    } catch (error) {
      const resolvedError = isNetworkFetchFailure(error)
        ? buildSupabaseConnectionError()
        : error;
      console.error("Unable to start login flow:", resolvedError);
      return { ok: false, error: resolvedError };
    }
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
   * List all users
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of users
   */
  async list(orderBy = "created_at", limit = null) {
    console.warn("User listing is not available without a users table.");
    return [];
  }

  /**
   * Filter users
   * @param {Object} conditions - Filter conditions
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of filtered users
   */
  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    console.warn("User filtering is not available without a users table.");
    return [];
  }
}

/**
 * Convert PascalCase entity name to snake_case table name
 * @param {string} entityName - Entity name in PascalCase
 * @returns {string} Table name in snake_case
 */
const ENTITY_TABLE_MAP = {
  Workspace: "workspaces",
  WorkspaceRole: "workspace_roles",
  WorkspaceAccessRule: "workspace_access_rules",
  WorkspaceAccessCode: "workspace_access_codes",
  Item: "items",
  ItemActivity: "item_activities",
  ItemStatusGroup: "item_status_groups",
  ItemStatus: "item_statuses",
  ApiToken: "api_tokens",
  AuditLog: "audit_logs",
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
        const entity = new CustomEntity(tableName);

        // Cache the entity for future use
        entityCache.set(entityName, entity);

        console.log(`Created entity: ${entityName} -> ${tableName}`);

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
  const decodeJwtPayload = (token) => {
    try {
      const [, payloadSegment] = token.split(".");
      if (!payloadSegment) return null;

      const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
      const base64 = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        "="
      );
      const decodeBase64 = (value) => {
        if (typeof atob === "function") {
          return atob(value);
        }
        if (typeof Buffer !== "undefined") {
          return Buffer.from(value, "base64").toString("binary");
        }
        return "";
      };

      return JSON.parse(decodeBase64(base64));
    } catch (error) {
      console.warn("Unable to decode JWT payload:", error);
      return null;
    }
  };

  const getValidFunctionAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token || null;
    if (!accessToken) {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError) {
        return null;
      }

      accessToken = refreshData?.session?.access_token || null;
      if (!accessToken) {
        return null;
      }
    }

    const decoded = decodeJwtPayload(accessToken);
    const issuer = decoded?.iss || "";
    const tokenExp = decoded?.exp ? Number(decoded.exp) * 1000 : null;
    const tokenExpired = tokenExp ? tokenExp <= Date.now() : false;
    const expectedHost = new URL(supabaseUrl).host;
    const issuerHost = issuer ? new URL(issuer).host : "";
    const tokenMatchesProject = !issuerHost || issuerHost === expectedHost;

    if (!tokenMatchesProject) {
      // Session belongs to a different Supabase project/environment.
      await supabase.auth.signOut();
      return null;
    }

    if (!tokenExpired) {
      return accessToken;
    }

    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("Unable to refresh expired auth session:", refreshError);
      await supabase.auth.signOut();
      return null;
    }

    accessToken = refreshData?.session?.access_token || null;
    return accessToken;
  };

  const invokeFunctionWithToken = async (name, payload, options, token) => {
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(token ? { "x-user-access-token": token } : {}),
    };

    return await supabase.functions.invoke(name, {
      body: payload,
      headers,
    });
  };

  return {
    entities: createEntitiesProxy(),
    auth: new UserEntity(),
    functions: {
      invoke: async (name, payload = {}, options = {}) => {
        const { authMode = "auto", ...invokeOptions } = options || {};
        const shouldUseUserToken = authMode !== "anon";
        let accessToken = shouldUseUserToken
          ? await getValidFunctionAccessToken()
          : null;

        if (authMode === "user" && !accessToken) {
          const authRequiredError = new Error("Authentication required");
          authRequiredError.status = 401;
          throw authRequiredError;
        }

        const initialToken =
          authMode === "anon" ? env.supabaseAnonKey : accessToken;

        let { data, error } = await invokeFunctionWithToken(
          name,
          payload,
          invokeOptions,
          initialToken
        );

        // Retry once on auth failure with a fresh token to avoid transient 401s
        // for authenticated invocations.
        if (error?.context?.status === 401 && shouldUseUserToken) {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();
          const refreshedToken =
            !refreshError && refreshData?.session?.access_token
              ? refreshData.session.access_token
              : null;

          if (refreshedToken && refreshedToken !== accessToken) {
            accessToken = refreshedToken;
            const retryResult = await invokeFunctionWithToken(
              name,
              payload,
              invokeOptions,
              accessToken
            );
            data = retryResult.data;
            error = retryResult.error;
          }
        }

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
