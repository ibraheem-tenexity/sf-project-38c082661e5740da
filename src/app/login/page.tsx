"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid credentials. Try demo@singerindustrial.com / Demo1234!");
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand mb-2">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-display-md font-display text-foreground">Ledger for Quotes</h1>
          <p className="text-body-md text-muted-foreground">Singer Industrial Quote Follow-Up Engine</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-heading-md">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="demo@singerindustrial.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Demo1234!"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in with Microsoft"}
              </Button>
            </form>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Demo: demo@singerindustrial.com / Demo1234!
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
