"use client";

import {
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Scale,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { seDeconnecter } from "@/app/actions/authentification";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const SECTIONS = [
  {
    titre: "Planification",
    liens: [
      { href: "/", libelle: "Tableau de bord", Icone: LayoutDashboard },
      { href: "/journees", libelle: "Journées pédagogiques", Icone: CalendarDays },
      { href: "/equite", libelle: "Équité", Icone: Scale },
    ],
  },
  {
    titre: "Données",
    liens: [
      { href: "/eleves", libelle: "Élèves", Icone: GraduationCap },
      { href: "/educateurs", libelle: "Éducateurs", Icone: Users },
      { href: "/parametres", libelle: "Paramètres", Icone: Settings },
    ],
  },
];

export function BarreLaterale({ courriel }: { courriel: string | null }) {
  const chemin = usePathname();

  const estActif = (href: string) =>
    href === "/" ? chemin === "/" : chemin.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <CalendarDays className="size-5 shrink-0" />
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Journées pédagogiques
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.titre}>
            <SidebarGroupLabel>{section.titre}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.liens.map(({ href, libelle, Icone }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={estActif(href)}
                      tooltip={libelle}
                      render={
                        <Link href={href}>
                          <Icone />
                          <span>{libelle}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-medium">{courriel ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                Service de garde en milieu scolaire
              </p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={seDeconnecter}>
              <SidebarMenuButton
                tooltip="Se déconnecter"
                render={<button type="submit" />}
              >
                <LogOut />
                <span>Se déconnecter</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/** Barre supérieure : bouton de repli + fil de la page courante. */
export function EnteteApplication() {
  const chemin = usePathname();
  const courant = SECTIONS.flatMap((s) => s.liens).find((l) =>
    l.href === "/" ? chemin === "/" : chemin.startsWith(l.href),
  );

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <span className="truncate text-sm font-medium">
        {courant?.libelle ?? "Planning des journées pédagogiques"}
      </span>
    </header>
  );
}
