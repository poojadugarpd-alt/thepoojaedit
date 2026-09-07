/**
 * Authorization error taxonomy. Route/action adapters map these to HTTP:
 *  - AuthenticationError -> 401
 *  - AuthorizationError  -> 403
 *  - ResourceNotFoundError -> 404 (also used to resist enumeration: a resource
 *    the caller may not see is reported as "not found", never "forbidden").
 */
export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Not permitted") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}
