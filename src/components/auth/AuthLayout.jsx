import { SparkIcon } from "../chat/icons";

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <div className="header-icon">
            <SparkIcon />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {children}

        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
