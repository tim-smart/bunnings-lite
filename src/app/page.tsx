import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function SearchPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0D5257]">
      {/* Header section */}
      <header className="w-full py-4">
        <div className="container flex flex-col items-center justify-center px-4 md:px-6 gap-16">
          {/* Logo */}
          <div className="flex items-center gap-2 pt-6">
            <Image
              src="https://media.bunnings.com.au/api/public/content/be094967988f4fe483401f14cb6584b8"
              alt="Bunnings Logo"
              width={150}
              height={50}
              className="h-auto w-auto"
            />
          </div>

          {/* Search Box */}
          <div className="w-full max-w-3xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for products..."
                className="w-full h-12 pl-10 border-2 rounded-md focus-visible:ring-[#db2a1c] focus-visible:border-[#db2a1c] bg-white"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-12 md:py-24">
        {/* This section is now empty but kept for structure */}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 py-6">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-white/70">
              © {new Date().getFullYear()} Bunnings. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-white/70 hover:text-white">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-white/70 hover:text-white">
                Terms of Service
              </a>
              <a href="#" className="text-sm text-white/70 hover:text-white">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
