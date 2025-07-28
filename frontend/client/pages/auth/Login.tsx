import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Construction className="w-12 h-12 text-slate-400" />
          </div>
          <CardTitle>Login Page</CardTitle>
          <CardDescription>
            This page is under construction and will be available soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 text-center">
            The login functionality will be implemented in a future update. 
            For now, you can continue browsing property listings without an account.
          </p>
          
          <div className="flex flex-col space-y-2">
            <Link to="/">
              <Button variant="outline" className="w-full flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Listings</span>
              </Button>
            </Link>
            
            <p className="text-xs text-center text-slate-500">
              Don't have an account? <Link to="/register" className="text-blue-600 hover:underline">Register here</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
