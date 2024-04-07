import { Link } from "@remix-run/react";

export function v0index() {
  return (
    <div className="w-full px-4 mx-auto grid grid-rows-[auto_1fr_auto] pb-24 bg-black text-white">
      <header>
        <div className="mx-auto h-14 flex items-center gap-4 p-4">
          <Link className="flex items-center justify-center" to="#">
            <FlameIcon className="h-6 w-6 text-blue-400" />
            <span className="sr-only">NeonFlare</span>
          </Link>
          <nav className="ml-auto flex gap-4 sm:gap-6">
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              to="#"
            >
              Features
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              to="#"
            >
              Documentation
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              to="#"
            >
              Community
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              to="https://github.com/pandemicsyn/neonflare"
            >
              GitHub
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full pt-12 md:pt-24 lg:pt-32 border-y border-gray-700">
          <div className="px-4 md:px-6 space-y-10 xl:space-y-16">
            <div className="grid max-w-[1300px] mx-auto gap-4 px-4 sm:px-6 md:px-10 md:grid-cols-2 md:gap-16">
              <div>
                <h1 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
                  <span className="text-green-500">Neon</span>
                  <span className="text-purple-500">Flare</span>: AI Driven
                  Incident Management for nimble teams.
                  {"\n                          "}
                </h1>
              </div>
              <div className="flex flex-col items-start space-y-4">
                <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl dark:text-gray-400">
                  An open-source on-call and incident management platform
                  self-hostable on Cloudflare. Status pages, team collaboration,
                  automated notifications, agent guided reviews and more.
                </p>
                <div className="space-x-4">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-300 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-400"
                    to="#"
                  >
                    Deploy Now
                  </Link>
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md border border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-500 shadow-sm transition-colors hover:bg-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 dark:border-blue-300 dark:text-blue-300 dark:hover:bg-blue-300 dark:hover:text-white dark:focus-visible:ring-blue-400"
                    to="#"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
            <img
              alt="Hero"
              className="mx-auto aspect-[3/1] overflow-hidden rounded-t-xl object-cover"
              height="300"
              src="/hero.webp"
              width="1270"
            />
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container space-y-12 px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-gray-800 px-3 py-1 text-sm dark:bg-gray-800">
                  Key Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Why <span className="text-green-500">Neon</span>
                  <span className="text-purple-500">Flare</span>?
                </h2>
                <p className="max-w-[900px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  <span className="text-green-500">Neon</span>
                  <span className="text-purple-500">Flare</span> is built small
                  nimble teams with a focus on agent guided incident management,
                  so you can focus on putting out the fire. Its 100% open-source
                  and self-hostable. No open-core bullshit.
                </p>
              </div>
            </div>
            <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">
                  AI Guided Incident Response
                </h3>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  With AI agent guided incident management, your teams can focus
                  on identifying and resolving incidents quickly. Post incident
                  updates at the click of a button. Get after-action reviews and
                  conduct guided post-mortems and retrospectives.
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">
                  Guided Post-Mortems and Retrospectives
                </h3>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  With agent guided post-mortems and retrospectives, your team
                  can learn from past incidents and improve your incident
                  management process. We even help you write or review your
                  post-mortem.
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-lg font-bold">Better Status Pages</h3>
                <p className="text-sm text-gray-300 dark:text-gray-400">
                  Keep your users informed with a customizable status page.
                  Provide real-time updates and incident history. Integrate
                  metric and monitoring data that matters, or use built-in
                  monitoring.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-800">
          <div className="container grid items-center justify-center gap-4 px-4 md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Built to run on Cloudflare.
              </h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                With a minimal setup and no ops overhead, NeonFlare is designed
                to fully leverage and run on the Cloudflare platform. For most
                small teams, the Cloudflare free tier will be more than enough.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-500 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-300 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-400"
                to="#"
              >
                Deploy now
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-blue-500 bg-white px-8 text-sm font-medium text-blue-500 shadow-sm transition-colors hover:bg-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 dark:border-blue-300 dark:text-blue-300 dark:hover:bg-blue-300 dark:hover:text-white dark:focus-visible:ring-blue-400"
                to="#"
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2024 NeonFlare. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" to="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" to="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function FlameIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
