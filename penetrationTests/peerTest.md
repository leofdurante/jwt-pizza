# Penetration Testing Report - JWT Pizza

## Both peers names

- Peer 1: Adriano
- Peer 2: Leo

## Self attack - Adriano

#### Attack 1

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.adrianodemartin.com (PUT /api/auth) |
| Classification | Identification and Authentication Failures |
| Severity | 2 |
| Description | Tried to brute force passwords. Got in. |
| Images | ![Attack 1](images/attack1.png) |
| Corrections | Add account lockout or exponential backoff, and rate-limit login endpoint. |

#### Attack 2

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.adrianodemartin.com (POST /api/order)|
| Classification | Broken Access Control |
| Severity | 0 |
| Description | Changed order and user IDs in Burp Repeater to test cross-user access. Unsuccessful. |
| Images | ![Attack 2](images/attack2.png) |
| Corrections | Enforce server-side ownership checks on all object access and mutations. |

#### Attack 3

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.adrianodemartin.com (GET /api/user/me) |
| Classification | Software and Data Integrity Failures |
| Severity | 0 |
| Description | Edited JWT token data and replayed protected requests. Unsuccessful. |
| Images | ![Attack 3](images/attack3.png) |
| Corrections | Enforce strict signature, exp, iss, and aud validation for all bearer tokens. |

#### Attack 4

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.adrianodemartin.com (PUT /api/user/20) |
| Classification | Injection |
| Severity | 3 |
| Description | Sent SQL-style input payloads to test unsafe input handling. High risk behavior observed. |
| Images | ![Attack 4](images/attack4.png) |
| Corrections | Validate and sanitize input; apply output encoding and safe query construction. |

#### Attack 5

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.adrianodemartin.com (GET /api/order/menu) |
| Classification | Security Misconfiguration |
| Severity | 1 |
| Description | Tested CORS and security headers using custom Origin values and response header checks. |
| Images | ![Attack 5](images/attack5.png) |
| Corrections | Restrict allowed origins and allow only known frontend origins. |

### Self attack - Leo

#### Attack 1

| Item | Result |
| --- | --- |
| Date | April 13, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (PUT /api/auth) |
| Classification | Identification and Authentication Failures |
| Severity | 1 |
| Description | Sent multiple password guesses in Burp Intruder against login. Failed responses returned verbose stack trace details. |
| Images | ![Leo self attack 1](intruder_results.png) |
| Corrections | Add login rate limiting or temporary lockout and return generic auth failures without stack traces. |

#### Attack 2

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (GET /api/franchise/:id) |
| Classification | Broken Access Control |
| Severity | 2 |
| Description | Changed franchise IDs in Burp Repeater while authenticated as a diner. Some IDs returned empty results while `/api/franchise/1` returned franchise and store data. |
| Images | ![Leo self attack 2](Repeater%20Franchise%203.png) |
| Corrections | Enforce role-based authorization on franchise reads and return explicit 403 when access is not allowed. |

#### Attack 3

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (POST /api/order) |
| Classification | Insecure Design / Software and Data Integrity Failures |
| Severity | 3 |
| Description | Modified order payload values in Burp Repeater. API accepted client-supplied `items[].price`, and invalid `menuId` produced 500 responses with stack traces. |
| Images | ![Leo self attack 3](Repeater%20Order%202.png) |
| Corrections | Recompute price server-side from menu data, validate franchise/store/menu IDs, and return safe 4xx errors without stack traces. |

#### Attack 4

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (GET /api/franchise?page=...&limit=...&name=...) |
| Classification | Injection (probe) / Security Misconfiguration |
| Severity | 1 |
| Description | Changed franchise search query values in Burp Repeater (`name=*`, encoded wildcard, long values) to test input handling. Broad wildcard matching was observed. |
| Images | ![Leo self attack 4](Repeater%20franchise%20name%203.png) |
| Corrections | Keep input length limits, maintain parameterized query handling, and preserve non-verbose failure responses. |

#### Attack 5

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (GET /api/user/me) |
| Classification | Identification and Authentication Failures |
| Severity | 0 |
| Description | Replayed protected requests with malformed bearer tokens in Burp Repeater. Server returned 401 unauthorized and did not expose user data. |
| Images | ![Leo self attack 5](fake%20token.png) |
| Corrections | No change required for token rejection; continue strict token validation and generic unauthorized responses. |

## Peer attack

### Adriano attack on Leo

#### Attack 1

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (PUT /api/user/:id) |
| Classification | Broken Access Control |
| Severity | 0 |
| Description | Attempted privilege escalation by setting roles to admin in PUT /api/user/:id. Server returned user and token with diner role only. Unsuccessful. |
| Images | ![Peer Attack 1](images/a_peer_attack1.png) |
| Corrections | Keep server-side role assignment only and ignore client-supplied role fields. |

#### Attack 2

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (PUT /api/auth) |
| Classification | Identification and Authentication Failures |
| Severity | 1 |
| Description | Tested login handling with invalid credentials on PUT /api/auth. Endpoint returned 404 unknown user plus stack trace details, exposing internal error behavior and aiding account-enumeration attempts. |
| Images | ![Peer Attack 2](images/a_peer_attack2.png) |
| Corrections | Return generic auth errors for all login failures and remove stack traces from production responses. |

#### Attack 3

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (PUT /api/user/:id) |
| Classification | Insecure Design |
| Severity | 0 |
| Description | Tested mass-assignment by adding extra body field (guapo) and role fields in PUT /api/user/:id. Server ignored unauthorized fields and preserved expected role values. Unsuccessful. |
| Images | ![Peer Attack 3](images/a_peer_attack3.png) |
| Corrections | Continue allow-listing accepted update fields and ignore all non-supported body properties. |

#### Attack 4

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (PUT /api/user/:id) |
| Classification | Injection |
| Severity | 2 |
| Description | Sent SQL-style payload in PUT /api/user/:id (name: "x', email='owned@jwt.com"). Response returned 404 unknown user with stack trace, indicating query behavior was altered by crafted input. |
| Images | ![Peer Attack 4](images/a_peer_attack4.png) |
| Corrections | Use parameterized queries for all user fields (name, email) and remove stack traces from production error responses. |

#### Attack 5

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.cs329pizzawebsite.click (GET /api/franchise?page=999&limit=10&name=*) |
| Classification | Security Misconfiguration |
| Severity | 0 |
| Description | Tested extreme pagination/filter input on GET /api/franchise?page=999&limit=10&name=*. Endpoint handled request safely and returned an empty result set without errors. Unsuccessful. |
| Images | ![Peer Attack 5](images/a_peer_attack5.png) |
| Corrections | Keep current pagination bounds and input handling; continue validating query parameters server-side. |

### Leo attack on Adriano

#### Attack 1

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.adrianodemartin.com (POST /api/order) |
| Classification | Insecure Design / Security Misconfiguration |
| Severity | 2 |
| Description | Changed order payload fields in Burp Repeater. Requests produced repeatable 500 `Failed to fulfil order at factory` responses. |
| Images | ![Leo attacking Adriano 1](attacking%20adriano%201.png) |
| Corrections | Validate order payloads before factory forwarding, return client-safe 4xx errors for invalid input, and avoid exposing internal operational references. |

#### Attack 2

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.adrianodemartin.com (GET /api/franchise, GET /api/franchise/:id) |
| Classification | Broken Access Control |
| Severity | 1 |
| Description | Tested franchise list and ID endpoints in Burp Repeater. List route returned data while ID route returned unauthorized in test case. |
| Images | ![Leo attacking Adriano 2](attacking%20adriano%202.png) |
| Corrections | Apply consistent role checks across list and detail franchise endpoints and minimize data returned to non-privileged users. |

#### Attack 3

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.adrianodemartin.com (PUT /api/auth) |
| Classification | Identification and Authentication Failures |
| Severity | 1 |
| Description | Sent multiple password guesses in Burp Intruder against login. Failed responses included verbose stack trace details. |
| Images | ![Leo attacking Adriano 3](attacking%20adriano%203.png) |
| Corrections | Add login throttling/lockout controls and remove stack/file-path details from auth failure responses. |

#### Attack 4

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.adrianodemartin.com (GET /api/franchise?...&name=...) |
| Classification | Injection (probe) / Security Misconfiguration |
| Severity | 1 |
| Description | Changed franchise search query values in Burp Repeater (`name=*`, `%25%25`, `test'`) to test input handling. Broad wildcard matching was observed. |
| Images | ![Leo attacking Adriano 4](attacking%20adriano%204.png) |
| Corrections | Enforce tighter search input constraints and keep parameterized query handling with stable error responses. |

#### Attack 5

| Item | Result |
| --- | --- |
| Date | April 14, 2026 |
| Target | pizza-service.adrianodemartin.com (GET /api/user/me) |
| Classification | Identification and Authentication Failures |
| Severity | 0 |
| Description | Replayed protected requests with invalid bearer tokens in Burp Repeater. Server returned 401 unauthorized and did not expose user data. |
| Images | ![Leo attacking Adriano 5](attacking%20adriano%205.png) |
| Corrections | No change required for this behavior; continue strict token validation and generic unauthorized responses. |

## Combined summary of learnings

This project showed us that small API mistakes can quickly become real security issues, especially around authentication, role/permission checks, and input handling. We learned that some attacks fail because protections are working like blocked role escalation and rejected JWT tampering and those are still important results to document. We also found that weak error handling can leak stack traces and help attackers understand backend behavior and that SQL style payloads can still affect query logic if inputs are not safely parameterized. Burp was most effective when used in order Proxy to discover requests, Repeater for controlled manual tests, and Intruder for repeated attempts. The biggest takeaway is to always enforce security on the server side, keep responses generic, validate all input, and use safe query patterns by default.


