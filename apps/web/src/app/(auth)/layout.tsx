const AuthLayout = ({ children }: LayoutProps<'/'>) => (
  <div className="flex flex-1 items-center justify-center p-6">
    <div className="w-full max-w-sm">{children}</div>
  </div>
);

export default AuthLayout;
