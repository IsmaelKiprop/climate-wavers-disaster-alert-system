import axios from "axios";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import { getAuthToken, logout, setUser } from "../utils/factory";
import Swal from "sweetalert2";
import { env } from "../config/env";

class Client {
  constructor(baseURL, domain) {
    this.baseUrl = baseURL;
    this.domain = domain;
    this._sessionExpiredPrompt = false;
  }

  formatErrorValue(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      return value.map((item) => this.formatErrorValue(item)).filter(Boolean).join("; ");
    }
    if (typeof value === "object") {
      if (value.message) return String(value.message);
      if (value.detail) return String(value.detail);
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return String(value);
  }

  handleSessionExpired() {
    if (this._sessionExpiredPrompt) return true;
    this._sessionExpiredPrompt = true;
    Swal.fire({
      icon: "warning",
      title: "Session expired",
      text: "Please sign in again to continue.",
      confirmButtonText: "Sign in",
      confirmButtonColor: "#067d83",
    }).then(() => {
      logout();
    });
    return true;
  }

  // Method to handle validation errors with SweetAlert
  isAuthCredentialFailure(error) {
    const url = String(error?.config?.url || "");
    const detail = String(error?.response?.data?.detail || "").toLowerCase();
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/verify-email") ||
      url.includes("/auth/resend-verification") ||
      url.includes("/auth/password-reset");
    if (!isAuthEndpoint) return false;
    return (
      detail.includes("email is not verified") ||
      detail.includes("invalid credentials") ||
      detail.includes("no active account") ||
      error?.response?.status === 401 ||
      error?.response?.status === 400
    );
  }

  handleValidationErrors(error) {
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      const status = error.response.status;
      const detail = String(errorData.detail || "");

      // Login/register 401s are credential or verification failures, not expired sessions.
      if (this.isAuthCredentialFailure(error)) {
        if (detail.toLowerCase().includes("email is not verified")) {
          Swal.fire({
            icon: "info",
            title: "Verify your email",
            text: "Enter the 6-digit code we sent, or resend a new one to continue.",
            confirmButtonText: "Verify email",
            confirmButtonColor: "#067d83",
          }).then((result) => {
            if (result.isConfirmed) {
              window.location.href = "/verifymail";
            }
          });
          return true;
        }
        return false;
      }

      // Expired / invalid JWT — never show as "Validation Error"
      if (
        status === 401 ||
        errorData.code === "token_not_valid" ||
        detail.toLowerCase().includes("token not valid")
      ) {
        return this.handleSessionExpired();
      }

      // Skip showing popup for follow-related errors (these are handled by components)
      if (errorData.detail === "You are already following this user.") {
        return false;
      }
      
      // Skip showing popup for 404 errors on post endpoints (these are handled by components)
      if (status === 404 && error.config?.url?.includes('/post/')) {
        return false;
      }
      if (status >= 500) {
        return false;
      }
      if (error.config?.url?.includes("/users/activity/")) {
        return false;
      }
      if (error.config?.url?.includes("/auth/password-reset")) {
        return false;
      }
      if (status === 503) {
        return false;
      }
      
      let errorMessages = [];

      // Handle different types of validation errors
      if (typeof errorData === 'object') {
        Object.keys(errorData).forEach(field => {
          if (field === "code") return;
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach(errorMsg => {
              const text = this.formatErrorValue(errorMsg);
              if (text) errorMessages.push(`${this.formatFieldName(field)}: ${text}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${this.formatFieldName(field)}: ${fieldErrors}`);
          } else {
            const text = this.formatErrorValue(fieldErrors);
            if (text) errorMessages.push(`${this.formatFieldName(field)}: ${text}`);
          }
        });
      }

      // Show SweetAlert with validation errors
      if (errorMessages.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          html: errorMessages.join('<br>'),
          confirmButtonText: 'Try Again',
          confirmButtonColor: '#067d83'
        });
        return true;
      }
    }
    return false;
  }

  // Format field names for better readability
  formatFieldName(field) {
    const fieldMap = {
      'password': 'Password',
      'password2': 'Confirm Password',
      'email': 'Email',
      'username': 'Username',
      'first_name': 'First Name',
      'last_name': 'Last Name',
      'country': 'Country',
      'state': 'State',
      'profession': 'Profession',
      'gender': 'Gender'
    };
    return fieldMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }

  // Method to show success message with SweetAlert
  showSuccessMessage(title, message, callback = null) {
    Swal.fire({
      icon: 'success',
      title: title,
      text: message,
      confirmButtonText: 'Continue',
      confirmButtonColor: '#067d83'
    }).then((result) => {
      if (result.isConfirmed && callback) {
        callback();
      }
    });
  }

  async run(
    method,
    endpoint,
    data,
    authheaders,
    toastMsg = false,
    authCookies = false,
    mail = false
  ) {
    const client = axios.create({
      baseURL: this.baseUrl,
    });

    const token = getAuthToken();

    const methodName = String(method || "get").toLowerCase();
    const config = {
      withCredentials: authheaders,
    };

    if (data != null && methodName !== "get" && methodName !== "head") {
      config.data = data;
    }

    if (authheaders) {
      config.headers = {
        "X-CSRFToken": `${Cookies.get("csrftoken") || ""}`,
      };
      // Only send Bearer when a real token exists (avoids "Bearer undefined" → token_not_valid).
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (!(data instanceof FormData)) {
        config.headers["Content-Type"] = "application/json";
      }
    }
    if (toastMsg) {
      toast.success(toastMsg.info, {
        autoClose: 1500,
      });
    }

    try {
      let response;
      try {
        response = await client({...config, method, url: endpoint});
      } catch (axiosError) {
        console.error('Axios request failed:', axiosError);
        throw axiosError;
      }
      
      if (authCookies) {
        const token = response.data?.access_token || response.data?.access;
        if (token) {
          Cookies.set("accessToken", token, { path: "/" });
        }
        const rawUser = response?.data?.user || response.data;
        if (rawUser && typeof rawUser === "object") {
          setUser(rawUser);
        }
      }

      if (mail) {
        Cookies.set("email", data.email);
      }
      if (toastMsg) {
        toast.dismiss();
        toast.success(toastMsg.success, {
          autoClose: 200,
        });
      }
      
      // Ensure response and response.data exist
      if (!response) {
        throw new Error('No response received from server');
      }
      
      if (!response.data) {
        throw new Error('Invalid response format - no data property');
      }
      
      return response.data;
    } catch (error) {
      console.log(error);
      
      // Handle validation errors with SweetAlert
      if (this.handleValidationErrors(error)) {
        // Validation errors are handled by SweetAlert, don't show toast
        throw error;
      }
      
      // Handle other errors with toast
      if (toastMsg) {
        toast.dismiss();
        toast.error(toastMsg.error);
      }
      throw error;
    }
  }
}

const client = new Client(env.backendUrl, env.domain);

export default client;
