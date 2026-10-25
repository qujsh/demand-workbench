import {
  ArrowLeft, ArrowRight, ArrowUpDown, Bell, Bold, Bookmark, CalendarDays,
  CalendarRange, ChartNoAxesGantt, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsUpDown, Circle, CircleAlert, CircleCheck, ClipboardCheck, ClipboardPaste,
  Combine, Copy, ExternalLink, Eye, FileCheck, FileText, Filter, FolderKanban,
  GitBranch, Image, Import, Inbox, Italic, LayoutDashboard, LayoutGrid, Link, List,
  ListFilter, ListOrdered, ListTree, LoaderCircle, LogOut, MapPin, MessageSquareText,
  MoreHorizontal, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Search, SearchX,
  Send, Settings, ShieldCheck, Sparkles, SquareCheckBig, Trash2, Underline,
  UserRound, Users, Wallet, WandSparkles, X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  ArrowLeft, ArrowRight, ArrowUpDown, Bell, Bold, Bookmark, CalendarDays,
  CalendarRange, ChartNoAxesGantt, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsUpDown, Circle, CircleAlert, CircleCheck, ClipboardCheck, ClipboardPaste,
  Combine, Copy, ExternalLink, Eye, FileCheck, FileText, Filter, FolderKanban,
  GitBranch, Image, Import, Inbox, Italic, LayoutDashboard, LayoutGrid, Link, List,
  ListFilter, ListOrdered, ListTree, LoaderCircle, LogOut, MapPin, MessageSquareText,
  MoreHorizontal, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Search, SearchX,
  Send, Settings, ShieldCheck, Sparkles, SquareCheckBig, Trash2, Underline,
  UserRound, Users, Wallet, WandSparkles, X,
};

interface IconProps extends LucideProps {
  name: string;
}

export function Icon({ name, size = 17, ...props }: IconProps) {
  const Component = icons[name] ?? Circle;
  return <Component size={size} strokeWidth={1.8} {...props} />;
}
