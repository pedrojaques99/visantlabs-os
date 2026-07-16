/**
 * Icon barrel — re-exports @phosphor-icons/react under the legacy lucide-react names.
 *
 * Single swap point for the lucide -> Phosphor migration: consumers keep importing the
 * same identifiers (e.g. `import { Search, Bell } from '@/lib/ui/icons'`), and only the
 * import SOURCE string changes at each call site. Left-hand export name = original lucide
 * name; right-hand = the Phosphor component. Lines tagged `// REVIEW` are med/low-confidence
 * glyph substitutions that a human should eyeball. Keep alphabetical.
 *
 * Do NOT add a default export. No React import required.
 */

export { Pulse as Activity } from '@phosphor-icons/react'; // REVIEW
export { WarningCircle as AlertCircle } from '@phosphor-icons/react';
export { Warning as AlertTriangle } from '@phosphor-icons/react';
export { TextAlignCenter as AlignCenter } from '@phosphor-icons/react';
export { AlignCenterHorizontal } from '@phosphor-icons/react';
export { AlignCenterVertical } from '@phosphor-icons/react';
export { AlignBottom as AlignEndHorizontal } from '@phosphor-icons/react'; // REVIEW
export { AlignRight as AlignEndVertical } from '@phosphor-icons/react'; // REVIEW
export { AlignCenterHorizontal as AlignHorizontalSpaceBetween } from '@phosphor-icons/react'; // REVIEW
export { AlignLeft } from '@phosphor-icons/react';
export { AlignRight } from '@phosphor-icons/react';
export { AlignTop as AlignStartHorizontal } from '@phosphor-icons/react'; // REVIEW
export { AlignLeft as AlignStartVertical } from '@phosphor-icons/react'; // REVIEW
export { AlignCenterVertical as AlignVerticalSpaceBetween } from '@phosphor-icons/react'; // REVIEW
export { AppWindow } from '@phosphor-icons/react';
export { Archive } from '@phosphor-icons/react';
export { Archive as ArchiveRestore } from '@phosphor-icons/react'; // REVIEW
export { ArrowDown } from '@phosphor-icons/react';
export { ArrowLineDown as ArrowDownToLine } from '@phosphor-icons/react';
export { ArrowLeft } from '@phosphor-icons/react';
export { ArrowsLeftRight as ArrowLeftRight } from '@phosphor-icons/react';
export { ArrowRight } from '@phosphor-icons/react';
export { ArrowUp } from '@phosphor-icons/react';
export { ArrowsDownUp as ArrowUpDown } from '@phosphor-icons/react';
export { ArrowUpRight } from '@phosphor-icons/react';
export { ArrowLineUp as ArrowUpToLine } from '@phosphor-icons/react';
export { Atom } from '@phosphor-icons/react';
export { ChartBar as BarChart } from '@phosphor-icons/react';
export { ChartBar as BarChart2 } from '@phosphor-icons/react';
export { ChartBar as BarChart3 } from '@phosphor-icons/react';
export { Flask as Beaker } from '@phosphor-icons/react';
export { Bell } from '@phosphor-icons/react';
export { Drop as Blend } from '@phosphor-icons/react'; // REVIEW
export { Blueprint as Blocks } from '@phosphor-icons/react'; // REVIEW
export { TextB as Bold } from '@phosphor-icons/react';
export { Book } from '@phosphor-icons/react';
export { Bookmark } from '@phosphor-icons/react';
export { BookBookmark as BookMarked } from '@phosphor-icons/react';
export { BookmarkSimple as BookmarkPlus } from '@phosphor-icons/react'; // REVIEW
export { BookOpen } from '@phosphor-icons/react';
export { Robot as Bot } from '@phosphor-icons/react';
export { Cube as Box } from '@phosphor-icons/react';
export { BracketsCurly as Braces } from '@phosphor-icons/react';
export { Brain } from '@phosphor-icons/react';
export { Briefcase } from '@phosphor-icons/react';
export { PaintBrush as Brush } from '@phosphor-icons/react';
export { Bug } from '@phosphor-icons/react';
export { Buildings as Building2 } from '@phosphor-icons/react';
export { Calculator } from '@phosphor-icons/react';
export { Calendar } from '@phosphor-icons/react';
export { Camera } from '@phosphor-icons/react';
export { Check } from '@phosphor-icons/react';
export { CheckCircle } from '@phosphor-icons/react';
export { CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
export { CheckSquare } from '@phosphor-icons/react';
export { CaretDown as ChevronDown } from '@phosphor-icons/react';
export { CaretLeft as ChevronLeft } from '@phosphor-icons/react';
export { CaretRight as ChevronRight } from '@phosphor-icons/react';
export { CaretDoubleDown as ChevronsDown } from '@phosphor-icons/react';
export { CaretDoubleUp as ChevronsUp } from '@phosphor-icons/react';
export { CaretUp as ChevronUp } from '@phosphor-icons/react';
export { Circle } from '@phosphor-icons/react';
export { CheckCircle as CircleCheck } from '@phosphor-icons/react';
export { Circle as CircleDot } from '@phosphor-icons/react'; // REVIEW
export { XCircle as CircleX } from '@phosphor-icons/react';
export { FilmSlate as Clapperboard } from '@phosphor-icons/react';
export { Clipboard } from '@phosphor-icons/react';
export { ClipboardText as ClipboardCheck } from '@phosphor-icons/react'; // REVIEW
export { Clipboard as ClipboardCopy } from '@phosphor-icons/react'; // REVIEW
export { ClipboardText as ClipboardList } from '@phosphor-icons/react';
export { Clipboard as ClipboardPaste } from '@phosphor-icons/react'; // REVIEW
export { Clock } from '@phosphor-icons/react';
export { Cloud } from '@phosphor-icons/react';
export { CloudArrowDown as CloudDownload } from '@phosphor-icons/react';
export { Code } from '@phosphor-icons/react';
export { Code as Code2 } from '@phosphor-icons/react';
export { Coffee } from '@phosphor-icons/react';
export { Coins } from '@phosphor-icons/react';
export { Command } from '@phosphor-icons/react';
export { Compass } from '@phosphor-icons/react';
export { Copy } from '@phosphor-icons/react';
export { ArrowElbowDownLeft as CornerDownLeft } from '@phosphor-icons/react';
export { Cpu } from '@phosphor-icons/react';
export { CreditCard } from '@phosphor-icons/react';
export { Crop } from '@phosphor-icons/react';
export { Crosshair } from '@phosphor-icons/react';
export { Crown } from '@phosphor-icons/react';
export { Coffee as CupSoda } from '@phosphor-icons/react'; // REVIEW
export { Database } from '@phosphor-icons/react';
export { Diamond } from '@phosphor-icons/react';
export { DiceFive as Dices } from '@phosphor-icons/react'; // REVIEW
export { Dna } from '@phosphor-icons/react';
export { CurrencyDollar as DollarSign } from '@phosphor-icons/react';
export { Download } from '@phosphor-icons/react';
export { Drop as Droplet } from '@phosphor-icons/react';
export { PencilSimple as Edit } from '@phosphor-icons/react';
export { PencilSimple as Edit2 } from '@phosphor-icons/react';
export { Pencil as Edit3 } from '@phosphor-icons/react';
export { Eraser } from '@phosphor-icons/react';
export { ArrowSquareOut as ExternalLink } from '@phosphor-icons/react';
export { Eye } from '@phosphor-icons/react';
export { EyeSlash as EyeOff } from '@phosphor-icons/react';
export { Factory } from '@phosphor-icons/react';
export { FigmaLogo as Figma } from '@phosphor-icons/react';
export { FileCode } from '@phosphor-icons/react';
export { FileArrowDown as FileDown } from '@phosphor-icons/react';
export { FileImage } from '@phosphor-icons/react';
export { FileArrowUp as FileInput } from '@phosphor-icons/react'; // REVIEW
export { FileCode as FileJson } from '@phosphor-icons/react'; // REVIEW
export { NotePencil as FilePenLine } from '@phosphor-icons/react';
export { FilePlus } from '@phosphor-icons/react';
export { Files } from '@phosphor-icons/react';
export { FileText } from '@phosphor-icons/react';
export { FileText as FileType } from '@phosphor-icons/react'; // REVIEW
export { FilmStrip as Film } from '@phosphor-icons/react';
export { Funnel as Filter } from '@phosphor-icons/react';
export { Flame } from '@phosphor-icons/react';
export { Crosshair as Focus } from '@phosphor-icons/react'; // REVIEW
export { Folder } from '@phosphor-icons/react';
export { Kanban as FolderKanban } from '@phosphor-icons/react'; // REVIEW
export { FolderOpen } from '@phosphor-icons/react';
export { FolderPlus } from '@phosphor-icons/react';
export { FrameCorners as Frame } from '@phosphor-icons/react'; // REVIEW
export { Gauge } from '@phosphor-icons/react';
export { Diamond as Gem } from '@phosphor-icons/react'; // REVIEW
export { GitBranch } from '@phosphor-icons/react';
export { GitDiff as GitCompareArrows } from '@phosphor-icons/react'; // REVIEW
export { GitFork } from '@phosphor-icons/react';
export { GithubLogo as Github } from '@phosphor-icons/react';
export { Globe } from '@phosphor-icons/react';
export { GridFour as Grid } from '@phosphor-icons/react';
export { GridNine as Grid3x3 } from '@phosphor-icons/react';
export { GridNine as Grid3X3 } from '@phosphor-icons/react';
export { DotsSixVertical as GripVertical } from '@phosphor-icons/react';
export { SelectionPlus as Group } from '@phosphor-icons/react'; // REVIEW
export { Hand } from '@phosphor-icons/react';
export { HardDrive } from '@phosphor-icons/react';
export { HardHat } from '@phosphor-icons/react';
export { Hash } from '@phosphor-icons/react';
export { Heart } from '@phosphor-icons/react';
export { Question as HelpCircle } from '@phosphor-icons/react';
export { ClockCounterClockwise as History } from '@phosphor-icons/react';
export { House as Home } from '@phosphor-icons/react';
export { Image } from '@phosphor-icons/react';
export { Image as ImageIcon } from '@phosphor-icons/react';
export { ImageBroken as ImageOff } from '@phosphor-icons/react';
export { ImageSquare as ImagePlus } from '@phosphor-icons/react'; // REVIEW
export { Images } from '@phosphor-icons/react';
export { Tray as Inbox } from '@phosphor-icons/react';
export { Info } from '@phosphor-icons/react';
export { InstagramLogo as Instagram } from '@phosphor-icons/react';
export { TextItalic as Italic } from '@phosphor-icons/react';
export { Key } from '@phosphor-icons/react';
export { Keyboard } from '@phosphor-icons/react';
export { Key as KeyRound } from '@phosphor-icons/react';
export { Translate as Languages } from '@phosphor-icons/react';
export { Lasso } from '@phosphor-icons/react';
export { Stack as Layers } from '@phosphor-icons/react';
export { StackSimple as Layers2 } from '@phosphor-icons/react';
export { Layout } from '@phosphor-icons/react';
export { SquaresFour as LayoutGrid } from '@phosphor-icons/react';
export { Layout as LayoutTemplate } from '@phosphor-icons/react'; // REVIEW
export { Leaf } from '@phosphor-icons/react';
export { Books as Library } from '@phosphor-icons/react';
export { Lightbulb } from '@phosphor-icons/react';
export { Link } from '@phosphor-icons/react';
export { LinkSimple as Link2 } from '@phosphor-icons/react';
export { LinkedinLogo as Linkedin } from '@phosphor-icons/react';
export { List } from '@phosphor-icons/react';
export { CircleNotch as Loader2 } from '@phosphor-icons/react';
export { Lock } from '@phosphor-icons/react';
export { LockOpen } from '@phosphor-icons/react';
export { SignIn as LogIn } from '@phosphor-icons/react';
export { SignOut as LogOut } from '@phosphor-icons/react';
export { Envelope as Mail } from '@phosphor-icons/react';
export { MapPin } from '@phosphor-icons/react';
export { CornersOut as Maximize } from '@phosphor-icons/react';
export { ArrowsOut as Maximize2 } from '@phosphor-icons/react';
export { Megaphone } from '@phosphor-icons/react';
export { List as Menu } from '@phosphor-icons/react';
export { ChatCircle as MessageCircle } from '@phosphor-icons/react';
export { ChatText as MessageSquare } from '@phosphor-icons/react';
export { ChatText as MessageSquareText } from '@phosphor-icons/react';
export { ArrowsIn as Minimize2 } from '@phosphor-icons/react';
export { Minus } from '@phosphor-icons/react';
export { Monitor } from '@phosphor-icons/react';
export { DeviceMobile as MonitorSmartphone } from '@phosphor-icons/react'; // REVIEW
export { Moon } from '@phosphor-icons/react';
export { DotsThree as MoreHorizontal } from '@phosphor-icons/react';
export { DotsThreeVertical as MoreVertical } from '@phosphor-icons/react';
export { Cursor as MousePointer2 } from '@phosphor-icons/react';
export { CursorClick as MousePointerClick } from '@phosphor-icons/react';
export { ArrowsOutCardinal as Move } from '@phosphor-icons/react';
export { ArrowsHorizontal as MoveHorizontal } from '@phosphor-icons/react';
export { MusicNote as Music } from '@phosphor-icons/react';
export { Package } from '@phosphor-icons/react';
export { Package as PackageOpen } from '@phosphor-icons/react'; // REVIEW
export { PaintBrush as Paintbrush } from '@phosphor-icons/react';
export { Palette } from '@phosphor-icons/react';
export { SidebarSimple as PanelLeftClose } from '@phosphor-icons/react';
export { SidebarSimple as PanelLeftOpen } from '@phosphor-icons/react';
export { SidebarSimple as PanelRight } from '@phosphor-icons/react';
export { SidebarSimple as PanelRightClose } from '@phosphor-icons/react';
export { SidebarSimple as PanelRightOpen } from '@phosphor-icons/react';
export { Paperclip } from '@phosphor-icons/react';
export { Pause } from '@phosphor-icons/react';
export { Pencil } from '@phosphor-icons/react';
export { PencilLine } from '@phosphor-icons/react';
export { PencilLine as PenLine } from '@phosphor-icons/react';
export { PenNib as PenTool } from '@phosphor-icons/react';
export { Pickaxe } from 'lucide-react'; // brand motif — no Phosphor glyph
export { PushPin as Pin } from '@phosphor-icons/react';
export { Eyedropper as Pipette } from '@phosphor-icons/react';
export { Play } from '@phosphor-icons/react';
export { Plug } from '@phosphor-icons/react';
export { Plus } from '@phosphor-icons/react';
export { Plus as PlusIcon } from '@phosphor-icons/react';
export { Presentation } from '@phosphor-icons/react';
export { Printer } from '@phosphor-icons/react';
export { PuzzlePiece as Puzzle } from '@phosphor-icons/react';
export { QrCode } from '@phosphor-icons/react';
export { ArrowClockwise as Redo2 } from '@phosphor-icons/react'; // REVIEW
export { ArrowsClockwise as RefreshCcw } from '@phosphor-icons/react';
export { ArrowsClockwise as RefreshCw } from '@phosphor-icons/react';
export { Rocket } from '@phosphor-icons/react';
export { ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';
export { ArrowClockwise as RotateCw } from '@phosphor-icons/react';
export { FloppyDisk as Save } from '@phosphor-icons/react';
export { Scales as Scale } from '@phosphor-icons/react';
export { Scan } from '@phosphor-icons/react';
export { MagnifyingGlass as ScanSearch } from '@phosphor-icons/react'; // REVIEW
export { Scissors } from '@phosphor-icons/react';
export { MagnifyingGlass as Search } from '@phosphor-icons/react';
export { MagnifyingGlass as SearchCheck } from '@phosphor-icons/react'; // REVIEW
export { PaperPlaneTilt as Send } from '@phosphor-icons/react';
export { HardDrives as Server } from '@phosphor-icons/react';
export { Gear as Settings } from '@phosphor-icons/react';
export { GearSix as Settings2 } from '@phosphor-icons/react';
export { Shapes } from '@phosphor-icons/react';
export { ShareNetwork as Share2 } from '@phosphor-icons/react';
export { Shield } from '@phosphor-icons/react';
export { ShieldCheck } from '@phosphor-icons/react';
export { TShirt as Shirt } from '@phosphor-icons/react';
export { ShoppingBag } from '@phosphor-icons/react';
export { ShoppingCart } from '@phosphor-icons/react';
export { Shuffle } from '@phosphor-icons/react';
export { Sliders } from '@phosphor-icons/react';
export { SlidersHorizontal } from '@phosphor-icons/react';
export { DeviceMobile as Smartphone } from '@phosphor-icons/react';
export { Sparkle as Sparkles } from '@phosphor-icons/react';
export { BezierCurve as Spline } from '@phosphor-icons/react'; // REVIEW
export { Square } from '@phosphor-icons/react';
export { Stamp } from '@phosphor-icons/react';
export { Star } from '@phosphor-icons/react';
export { Stethoscope } from '@phosphor-icons/react';
export { TextStrikethrough as Strikethrough } from '@phosphor-icons/react';
export { Sun } from '@phosphor-icons/react';
export { SunHorizon as SunMoon } from '@phosphor-icons/react'; // REVIEW
export { SunHorizon as Sunset } from '@phosphor-icons/react'; // REVIEW
export { Swatches as SwatchBook } from '@phosphor-icons/react';
export { Table } from '@phosphor-icons/react';
export { Table as Table2 } from '@phosphor-icons/react';
export { Tag } from '@phosphor-icons/react';
export { Tag as Tags } from '@phosphor-icons/react'; // REVIEW
export { Target } from '@phosphor-icons/react';
export { Terminal } from '@phosphor-icons/react';
export { ThumbsDown } from '@phosphor-icons/react';
export { ThumbsUp } from '@phosphor-icons/react';
export { Timer } from '@phosphor-icons/react';
export { Trash as Trash2 } from '@phosphor-icons/react';
export { TrendDown as TrendingDown } from '@phosphor-icons/react';
export { TrendUp as TrendingUp } from '@phosphor-icons/react';
export { Trophy } from '@phosphor-icons/react';
export { TwitterLogo as Twitter } from '@phosphor-icons/react';
export { TextT as Type } from '@phosphor-icons/react';
export { TextUnderline as Underline } from '@phosphor-icons/react';
export { ArrowCounterClockwise as Undo2 } from '@phosphor-icons/react'; // REVIEW
export { Selection as Ungroup } from '@phosphor-icons/react'; // REVIEW
export { LinkBreak as Unlink } from '@phosphor-icons/react';
export { LockOpen as Unlock } from '@phosphor-icons/react';
export { Plugs as Unplug } from '@phosphor-icons/react'; // REVIEW
export { Upload } from '@phosphor-icons/react';
export { CloudArrowUp as UploadCloud } from '@phosphor-icons/react';
export { UploadSimple as UploadIcon } from '@phosphor-icons/react';
export { User } from '@phosphor-icons/react';
export { UserCircle } from '@phosphor-icons/react';
export { UserGear as UserCog } from '@phosphor-icons/react';
export { UserPlus } from '@phosphor-icons/react';
export { Users } from '@phosphor-icons/react';
export { Video } from '@phosphor-icons/react';
export { SpeakerHigh as Volume2 } from '@phosphor-icons/react';
export { SpeakerX as VolumeX } from '@phosphor-icons/react';
export { MagicWand as Wand2 } from '@phosphor-icons/react';
export { Wind } from '@phosphor-icons/react';
export { FlowArrow as Workflow } from '@phosphor-icons/react'; // REVIEW
export { Wrench } from '@phosphor-icons/react';
export { X } from '@phosphor-icons/react';
export { XCircle } from '@phosphor-icons/react';
export { X as XIcon } from '@phosphor-icons/react';
export { XCircle as XOctagon } from '@phosphor-icons/react'; // REVIEW
export { YoutubeLogo as Youtube } from '@phosphor-icons/react';
export { Lightning as Zap } from '@phosphor-icons/react';
export { MagnifyingGlassPlus as ZoomIn } from '@phosphor-icons/react';
export { MagnifyingGlassMinus as ZoomOut } from '@phosphor-icons/react';

// ---- Types (isolatedModules on, no verbatimModuleSyntax) ----
export type { Icon as IconComponent } from '@phosphor-icons/react';
export type { Icon as LucideIcon } from '@phosphor-icons/react';
