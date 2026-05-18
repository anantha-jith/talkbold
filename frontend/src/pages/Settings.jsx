import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card"

export function Settings() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account settings will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">There are no configurable settings at this time.</p>
        </CardContent>
      </Card>
    </div>
  )
}
