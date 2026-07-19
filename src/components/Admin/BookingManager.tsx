import { useState, useEffect, useMemo } from "react";
import { db, auth } from "../../lib/firebase";
import { updateDoc, deleteDoc, doc, serverTimestamp, getDoc, collection, addDoc } from "firebase/firestore";
import { Booking, UserProfile, Guide, BookingLog, CommunicationSettings, Tour } from "../../types";
import * as Icons from "lucide-react";
import { 
  format, 
  parseISO, 
  addDays, 
  isToday, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  isSameMonth, 
  isSameDay, 
  subMonths 
} from "date-fns";
import { cn, formatPrice } from "../../lib/utils";
import { sendCustomWhatsApp, generateBookingMessage } from "../../lib/whatsappService";
import { sendBookingEmail } from "../../lib/emailService";

interface BookingManagerProps {
  setGlobalSelectedBooking: (booking: Booking | null) => void;
  setOriginalBooking: (booking: Booking | null) => void;
  setIsBookingDetailOpen: (open: boolean) => void;
  setAssignBooking: (booking: Booking | null) => void;
  setIsAssignOpen: (open: boolean) => void;
  handlePrintManifest: (booking: Booking) => void;
  updateBookingStatus: (id: string, status: any) => Promise<void>;
  handleDeleteBooking: (id: string) => Promise<void>;
  allGuides: Guide[];
  currentUserProfile: UserProfile | null;
  bookings: Booking[];
  initialView?: 'list' | 'daily' | 'calendar';
  tours?: Tour[];
}

export default function BookingManager({
  setGlobalSelectedBooking,
  setOriginalBooking,
  setIsBookingDetailOpen,
  setAssignBooking,
  setIsAssignOpen,
  handlePrintManifest,
  updateBookingStatus,
  handleDeleteBooking,
  allGuides = [],
  currentUserProfile,
  bookings = [],
  initialView = 'list',
  tours = []
}: BookingManagerProps) {
  // Navigation & Display Toggles
  const [viewMode, setViewMode] = useState<'list' | 'daily' | 'calendar'>(() => {
    if (initialView === 'calendar') return 'calendar';
    const saved = localStorage.getItem("booking_manager_view_mode");
    if (saved === 'list' || saved === 'daily' || saved === 'calendar') {
      return saved as 'list' | 'daily' | 'calendar';
    }
    return initialView || 'list';
  });

  useEffect(() => {
    localStorage.setItem("booking_manager_view_mode", viewMode);
  }, [viewMode]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // High-performance Pagination (Critical for 1000 Bookings/Day)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Time-frame filters: Easily filter by Day, Month, Year
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [dateFilterType, setDateFilterType] = useState<'tour' | 'booked'>('tour'); // Filter by departure date or booking creation date
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [quickShortcut, setQuickShortcut] = useState<string>("all");

  // Grid/Data filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGuideState, setFilterGuideState] = useState<string>("all"); // 'all', 'assigned', 'unassigned'
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTourId, setFilterTourId] = useState<string>("all");

  // Multi-Select States for bulk updates
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkGuide, setBulkGuide] = useState<string>("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Loading indicator for row level async operations
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Sync state with prop updates
  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  // Guides scoped by supplier permission rules
  const guides = useMemo(() => {
    if (currentUserProfile?.role === 'supplier') {
      return allGuides.filter(g => g.supplierId === currentUserProfile.uid);
    }
    return allGuides;
  }, [allGuides, currentUserProfile]);

  // Dynamically compile available tours list from bookings list + prop tours list
  const tourOptions = useMemo(() => {
    const optionsMap = new Map<string, string>();
    
    // Add official tours list if provided
    if (tours && tours.length > 0) {
      tours.forEach(t => {
        if (t.id && t.title) {
          optionsMap.set(t.id, t.title);
        }
      });
    }
    
    // Supplement from existing bookings to ensure old/custom tours can be filtered as well
    bookings.forEach(b => {
      if (b.tourId && b.tourTitle) {
        optionsMap.set(b.tourId, b.tourTitle);
      } else if (b.tourTitle) {
        optionsMap.set(b.tourTitle, b.tourTitle);
      }
    });

    return Array.from(optionsMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tours, bookings]);

  // Dynamically build years options based on actual bookings data + default list
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add((currentYear - 1).toString());
    years.add(currentYear.toString());
    years.add((currentYear + 1).toString());
    
    bookings.forEach(b => {
      if (b.date) {
        const yr = b.date.split('-')[0];
        if (yr && yr.length === 4) years.add(yr);
      }
    });
    return Array.from(years).sort().reverse();
  }, [bookings]);

  // Complete highly optimized Filter Loop (Extremely fast under high volumes)
  const filteredBookings = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const monthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    return bookings
      .filter(b => {
        // Scoped to supplier roles
        if (currentUserProfile?.role === 'supplier') {
          return b.supplierId === currentUserProfile.uid;
        }
        return true;
      })
      .filter(b => {
        // Filter by specific Tour
        if (filterTourId !== 'all') {
          return b.tourId === filterTourId || b.tourTitle === filterTourId;
        }
        return true;
      })
      .filter(b => {
        // Direct booking status
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
      })
      .filter(b => {
        // Guide assigned filters
        if (filterGuideState === 'assigned') return !!b.assignedGuideId;
        if (filterGuideState === 'unassigned') return b.status !== 'cancelled' && !b.assignedGuideId;
        return true;
      })
      .filter(b => {
        // Booking source filters
        if (filterSource !== 'all' && b.bookingSource !== filterSource) return false;
        return true;
      })
      .filter(b => {
        // Evaluate dynamic combinations of Day, Month, Year, Shortcuts, and Custom Range
        let targetDateStr = b.date; // default tour departure date

        if (dateFilterType === 'booked') {
          try {
            if (b.createdAt) {
              const createdDate = typeof b.createdAt === 'string' 
                ? parseISO(b.createdAt) 
                : (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt));
              targetDateStr = format(createdDate, 'yyyy-MM-dd');
            }
          } catch (e) {
            targetDateStr = b.date;
          }
        }

        if (!targetDateStr) return false;

        // Apply quick timeline shortcuts (preempts manual dropdowns)
        if (quickShortcut !== 'all') {
          if (quickShortcut === 'today') return targetDateStr === todayStr;
          if (quickShortcut === 'tomorrow') return targetDateStr === tomorrowStr;
          if (quickShortcut === 'this_month') return targetDateStr >= monthStartStr && targetDateStr <= monthEndStr;
        }

        // Apply Custom Date Range picker
        if (customRange.start && customRange.end) {
          return targetDateStr >= customRange.start && targetDateStr <= customRange.end;
        }

        // Split standard date yyyy-MM-dd
        const dateParts = targetDateStr.split('-');
        if (dateParts.length < 3) return false;
        const [yr, mo, dy] = dateParts;

        if (selectedYear !== 'all' && yr !== selectedYear) return false;
        if (selectedMonth !== 'all' && mo !== selectedMonth) return false;
        if (selectedDay !== 'all' && dy !== selectedDay) return false;

        return true;
      })
      .filter(b => {
        // Text Match search queries
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          b.id.toLowerCase().includes(q) ||
          b.customerData.fullName.toLowerCase().includes(q) ||
          b.customerData.email.toLowerCase().includes(q) ||
          (b.customerData.phone || "").toLowerCase().includes(q) ||
          (b.tourTitle || "").toLowerCase().includes(q) ||
          (b.packageName || "").toLowerCase().includes(q) ||
          (b.assignedGuideName || "").toLowerCase().includes(q) ||
          (b.internalNotes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Default sorted chronologically by Scheduled Tour Date
        return b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '');
      });
  }, [bookings, filterStatus, filterGuideState, filterSource, dateFilterType, selectedYear, selectedMonth, selectedDay, quickShortcut, customRange, searchQuery, currentUserProfile, filterTourId]);

  // Aggregate stats telemetry (Dynamic calculations on active results)
  const stats = useMemo(() => {
    const list = filteredBookings;
    const totalCount = list.length;
    const pendingCount = list.filter(b => b.status === 'pending').length;
    const confirmedCount = list.filter(b => b.status === 'confirmed').length;
    const completedCount = list.filter(b => b.status === 'completed').length;
    const cancelledCount = list.filter(b => b.status === 'cancelled').length;
    
    const activePax = list
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);
      
    const activeRevenue = list
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const assignedCount = list.filter(b => b.status !== 'cancelled' && b.assignedGuideId).length;
    const uncompletedActiveCount = list.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length;
    const unassignedCount = uncompletedActiveCount - list.filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.assignedGuideId).length;

    return {
      total: totalCount,
      pending: pendingCount,
      confirmed: confirmedCount,
      completed: completedCount,
      cancelled: cancelledCount,
      pax: activePax,
      revenue: activeRevenue,
      assigned: assignedCount,
      unassigned: Math.max(0, unassignedCount)
    };
  }, [filteredBookings]);

  // Core Pagination Renders
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));

  // Reset pagination dynamically whenever standard filters adapt
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [filterStatus, filterGuideState, filterSource, dateFilterType, selectedYear, selectedMonth, selectedDay, quickShortcut, customRange, searchQuery, filterTourId]);

  // Inline Quick Actions (Direct updates on Row level)
  const handleQuickStatusUpdate = async (booking: Booking, nextStatus: any) => {
    setSavingRowId(booking.id);
    try {
      const logger: BookingLog = {
        timestamp: new Date().toISOString(),
        type: 'status_change',
        message: `Status updated to ${nextStatus.toUpperCase()} via Quick Dispatch Controls`,
        userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
      };
      
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        logs: [...(booking.logs || []), logger]
      });
    } catch (e) {
      console.error(e);
      alert("Error updating status inline.");
    } finally {
      setSavingRowId(null);
    }
  };

  const handleQuickAssignGuide = async (booking: Booking, guideId: string) => {
    setSavingRowId(booking.id);
    try {
      if (!guideId) {
        // Unassignment Flow
        const logger: BookingLog = {
          timestamp: new Date().toISOString(),
          type: 'assignment',
          message: `Guide unassigned via Quick Dispatch Controls`,
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
        };
        await updateDoc(doc(db, 'bookings', booking.id), {
          assignedGuideId: null,
          assignedGuideName: null,
          assignedGuideWhatsapp: null,
          updatedAt: serverTimestamp(),
          logs: [...(booking.logs || []), logger]
        });
      } else {
        const guide = guides.find(g => g.id === guideId);
        if (guide) {
          // Trigger automatic dispatch flow (same as Admin parent method!)
          await handleTriggerGuideDispatch(booking, guide);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Error assigning guide inline.");
    } finally {
      setSavingRowId(null);
    }
  };

  // Automated notification and email services trigger
  const handleTriggerGuideDispatch = async (booking: Booking, guide: Guide) => {
    // Scaffold WhatsApp messages
    let dispatchMsg = `*Tour Details Assignment*\n\n`;
    dispatchMsg += `Name of guest: ${booking.customerData.fullName}\n`;
    dispatchMsg += `No of guest: ${booking.participants.adults} Adults, ${booking.participants.children} Children\n`;
    dispatchMsg += `Pick up address: ${booking.customerData.pickupAddress || 'N/A'}\n`;
    dispatchMsg += `Guest Whatsapp Number: ${booking.customerData.phone}\n`;
    dispatchMsg += `Tour date: ${booking.date}\n`;
    dispatchMsg += `Tours: ${booking.tourTitle}\n`;
    dispatchMsg += `Package Booked: ${booking.packageName}\n`;

    if (booking.selectedAddOns && booking.selectedAddOns.length > 0) {
      dispatchMsg += `\n*Add-ons:*\n`;
      booking.selectedAddOns.forEach(addon => {
        dispatchMsg += `- ${addon.name} (x${addon.quantity})\n`;
      });
    }

    const packagedBooking = {
      ...booking,
      assignedGuideId: guide.id,
      assignedGuideName: guide.name,
      assignedGuideWhatsapp: guide.whatsapp
    };

    // Whapi Dispatch Notification to Guide
    try {
      await sendCustomWhatsApp(guide.whatsapp, dispatchMsg, packagedBooking, true, false);
    } catch (err) {
      console.warn("Guide WhatsApp auto dispatch failed:", err);
    }

    // Whapi Notification update to Guest
    try {
      const settingsSnap = await getDoc(doc(db, 'communicationSettings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as CommunicationSettings : null;
      
      let customerMsg = `*Guide Assigned*\n\nHello ${booking.customerData.fullName}, we have assigned a guide for your tour "${booking.tourTitle}" on ${booking.date}.\n\n*Your Guide:* ${guide.name}\n*Guide WhatsApp:* ${guide.whatsapp}\n\nOur guide will contact you soon for pickup details. Enjoy your trip!`;
      
      if (settings?.whatsappTemplates?.guide_assigned?.enabled) {
        const template = settings.whatsappTemplates.guide_assigned.message;
        customerMsg = generateBookingMessage(template, packagedBooking);
      }
      
      await sendCustomWhatsApp(booking.customerData.phone || '', customerMsg, packagedBooking, false, true);
    } catch (err) {
      console.warn("Guest WhatsApp auto alert failed:", err);
    }

    // Email Dispatch Alerts
    try {
      await sendBookingEmail('guide_assigned', packagedBooking);
    } catch (err) {
      console.warn("Guide auto email Dispatch alert failed:", err);
    }

    // Commit state updates to database
    const logger: BookingLog = {
      timestamp: new Date().toISOString(),
      type: 'assignment',
      message: `Guide assigned: ${guide.name} (+${guide.whatsapp})`,
      userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
    };

    await updateDoc(doc(db, 'bookings', booking.id), {
      assignedGuideId: guide.id,
      assignedGuideName: guide.name,
      assignedGuideWhatsapp: guide.whatsapp,
      updatedAt: serverTimestamp(),
      logs: [...(booking.logs || []), logger]
    });
  };

  // Bulk Actions
  const handleToggleSelectAll = () => {
    const listIds = paginatedList.map(b => b.id);
    const allSelected = listIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !listIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const next = [...prev];
        listIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleSelectRow = (id: string, e: any) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const executeBulkStatusChange = async (nextStatus: 'confirmed' | 'cancelled' | 'completed' | 'pending') => {
    if (!selectedIds.length) return;
    if (!confirm(`Are you sure you want to change status to ${nextStatus.toUpperCase()} for the ${selectedIds.length} selected bookings?`)) return;

    setIsBulkProcessing(true);
    try {
      for (const id of selectedIds) {
        const b = bookings.find(x => x.id === id);
        if (b) {
          const logger: BookingLog = {
            timestamp: new Date().toISOString(),
            type: 'status_change',
            message: `Bulk status update to: ${nextStatus.toUpperCase()}`,
            userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
          };
          await updateDoc(doc(db, 'bookings', id), {
            status: nextStatus,
            updatedAt: serverTimestamp(),
            logs: [...(b.logs || []), logger]
          });
        }
      }
      alert(`Bulk update complete! Modified status to ${nextStatus.toUpperCase()} on ${selectedIds.length} items.`);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      alert("Failure executing bulk updates.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const executeBulkGuideAssign = async () => {
    if (!selectedIds.length || !bulkGuide) return;
    const guide = guides.find(g => g.id === bulkGuide);
    if (!guide) return;

    if (!confirm(`Do you wish to dispatch ${guide.name} for the ${selectedIds.length} selected bookings?`)) return;

    setIsBulkProcessing(true);
    try {
      let runCount = 0;
      for (const id of selectedIds) {
        const b = bookings.find(x => x.id === id);
        if (b && b.status !== 'cancelled') {
          await handleTriggerGuideDispatch(b, guide);
          runCount++;
        }
      }
      alert(`Successfully dispatched ${guide.name} to ${runCount} active tours.`);
      setSelectedIds([]);
      setBulkGuide("");
    } catch (e) {
      console.error(e);
      alert("Error occurred during bulk guide dispatching.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const executeBulkDelete = async () => {
    if (currentUserProfile?.role !== 'admin') {
      alert("Access Restricted: Only Super Admin accounts can delete bookings.");
      return;
    }
    if (!selectedIds.length) return;
    if (!confirm(`🚨 EXTREME CAUTION: Personally confirm permanent deletion of ${selectedIds.length} bookings? This is 100% irreversible.`)) return;

    setIsBulkProcessing(true);
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'bookings', id));
      }
      alert(`Successfully removed ${selectedIds.length} booking records completely.`);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      alert("Bulk delete operations aborted due to missing permissions.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Excel Spreadsheet Download Parser
  const exportToExcelFormat = () => {
    const listToExport = filteredBookings;
    if (!listToExport.length) {
      alert("No matching bookings to export.");
      return;
    }

    const headers = [
      "ID", "Trip Date", "Pickup Time", "Customer Lead Name", "WhatsApp", "Email", 
      "Nationality", "Tour Title", "Selected Product Package", "Pax Size", "Total Value",
      "Source", "Dispatch Status", "Assigned Operator/Driver", "Internal Notes"
    ];

    const dataCSV = listToExport.map(b => [
      b.id, b.date, b.time || 'N/A', b.customerData.fullName, b.customerData.phone, b.customerData.email,
      b.customerData.nationality || b.customerData.country || 'N/A', b.tourTitle, b.packageName,
      `Adults: ${b.participants?.adults || 0} - Children: ${b.participants?.children || 0}`, b.totalAmount,
      b.bookingSource || 'Direct', b.status, b.assignedGuideName || '🚨 UNASSIGNED',
      (b.internalNotes || '').replace(/\r?\n|\r/g, ' ')
    ]);

    const finalCSVString = [
      headers.join(','),
      ...dataCSV.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const byteBlob = new Blob([finalCSVString], { type: 'text/csv;charset=utf-8;' });
    const dynamicURL = URL.createObjectURL(byteBlob);
    const trigger = document.createElement("a");
    trigger.setAttribute("href", dynamicURL);
    trigger.setAttribute("download", `spreadsheet_bookings_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(trigger);
    trigger.click();
    document.body.removeChild(trigger);
  };

  // Landscape optimized printable manifest generator
  const triggerLandscapePrintPdf = () => {
    const printer = window.open('', '_blank');
    if (!printer) return;

    const manifestTableRows = filteredBookings.map(b => `
      <tr style="border-bottom: 1px solid #e1e8ed; font-size: 11px;">
        <td style="padding: 6px 10px; font-family: monospace; font-weight: bold; color: #1e293b;">#${b.id.slice(-8)}</td>
        <td style="padding: 6px 10px;">${b.date} <br><small style="color:#64748b font-weight: bold;">${b.time || ''}</small></td>
        <td style="padding: 6px 10px; font-weight: bold; color: #0f172a;">${b.customerData.fullName}<br><small style="color: #64748b; font-weight: normal;">+${b.customerData.phone}</small></td>
        <td style="padding: 6px 10px;"><strong>${b.tourTitle}</strong><br><small style="color:#0ea5e9; font-weight: bold;">${b.packageName}</small></td>
        <td style="padding: 6px 10px; font-weight: bold; text-align: center;">${(b.participants?.adults || 0) + (b.participants?.children || 0)} PAX<br><span style="font-size: 9px; color:#64748b">${b.participants?.adults}A, ${b.participants?.children}C</span></td>
        <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #16a34a;">${formatPrice(b.totalAmount)}</td>
        <td style="padding: 6px 10px;">
          <span style="display:inline-block; padding: 2.5px 6px; border-radius: 4px; font-size: 8px; font-weight: 900; text-transform: uppercase;
            background-color: ${b.status === 'confirmed' ? '#dcfce7; color: #15803d' : b.status === 'completed' ? '#dbeafe; color: #1d4ed8' : b.status === 'cancelled' ? '#fee2e2; color: #b91c1c' : '#fef3c7; color: #b45309'}">
            ${b.status}
          </span>
        </td>
        <td style="padding: 6px 10px; font-weight: bold; font-size: 10px;">${b.assignedGuideName || '<span style="color:#e11d48; font-weight:900;">🚨 VACANT</span>'}</td>
        <td style="padding: 6px 10px; font-size: 10px; color:#475569;">${b.internalNotes || b.customerData.pickupAddress || ''}</td>
      </tr>
    `).join('');

    printer.document.write(`
      <html>
        <head>
          <title>OPERATIONS MANIFEST REPORT - ${format(new Date(), 'yyyy-MM-dd')}</title>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 10px; font-size: 10px; font-weight: 850; text-transform: uppercase; tracking: 0.05em; text-align: left; color:#475569; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3.5px solid #0f172a; padding-bottom: 12px; }
            .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.01em; margin: 0; }
            .telemetry-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 15px; background-color: #f1f5f9; padding: 15px; border-radius: 8px; }
            .telemetry-card { display: flex; flex-direction: column; }
            .telemetry-card span { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .telemetry-card strong { font-size: 17px; font-weight: 900; margin-top: 3px; }
            @media print {
              body { margin: 10px; }
              .ctrl-panel-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Operations Departure Manifest</h1>
              <p style="font-size: 11px; margin-top: 3px; font-weight: bold; color: #475569;">
                Printed on ${format(new Date(), 'dd MMMM yyyy HH:mm')} | Scoped Manifest Filters
              </p>
            </div>
            <button onclick="window.print()" class="ctrl-panel-btn" style="padding: 10px 18px; bg-color: #0ea5e9; background: #0ea5e9; color: white; border: none; font-weight: 900; border-radius: 6px; text-transform: uppercase; font-size: 10px; cursor: pointer;">
              🖨️ LANDSCAPE PRINT / EXPORT PDF
            </button>
          </div>

          <div class="telemetry-row">
            <div class="telemetry-card">
              <span>ACTIVE MANIFESTED TRIPS</span>
              <strong>${stats.total} Reservations</strong>
            </div>
            <div class="telemetry-card">
              <span>MANIFEST CAPACITY</span>
              <strong>${stats.pax} Passengers</strong>
            </div>
            <div class="telemetry-card">
              <span>AGGREGATE DISPATCH VALUE</span>
              <strong>${formatPrice(stats.revenue)}</strong>
            </div>
            <div class="telemetry-card">
              <span>DISPATCHING RATIO</span>
              <strong>${stats.assigned} Assigned / ${stats.unassigned} Vacant</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 85px;">ID</th>
                <th style="width: 110px;">Scheduled Drop</th>
                <th style="width: 140px;">Passenger Lead</th>
                <th>Tour Manifest Component</th>
                <th style="width: 90px; text-align: center;">Seats</th>
                <th style="text-align: right; width: 110px;">Collect Amount</th>
                <th style="width: 90px;">Status</th>
                <th style="width: 130px;">Assigned Crew</th>
                <th style="width: 200px;">Internal Dispatch Logistics/Address</th>
              </tr>
            </thead>
            <tbody>
              ${manifestTableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printer.document.close();
  };

  // Chronological Daily Dispatch View States
  const [targetDailyDate, setTargetDailyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const targetDailyBookings = useMemo(() => {
    return bookings
      .filter(b => {
        if (currentUserProfile?.role === 'supplier') {
          return b.supplierId === currentUserProfile.uid;
        }
        return true;
      })
      .filter(b => b.date === targetDailyDate)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [bookings, targetDailyDate, currentUserProfile]);

  const dailyScheduleStats = useMemo(() => {
    const active = targetDailyBookings;
    const total = active.length;
    const uncompletedActive = active.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length;
    const assigned = active.filter(b => b.status !== 'cancelled' && b.assignedGuideId).length;
    
    const passengerSum = active
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);

    return {
      total,
      pax: passengerSum,
      assigned,
      unassigned: Math.max(0, uncompletedActive - active.filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.assignedGuideId).length),
      cancelled: active.filter(b => b.status === 'cancelled').length
    };
  }, [targetDailyBookings]);

  // Share Brief Dispatch sheet formatted text on Clipboard for driver groups WhatsApping
  const handleCopyWhatsappBriefing = () => {
    if (!targetDailyBookings.length) {
      alert("No operations scheduled on this date to brief.");
      return;
    }
    let briefingText = `*🚨 DISPATCH DIRECTIVE SHEET - ${format(parseISO(targetDailyDate), 'EEEE, d MMMM yyyy').toUpperCase()}*\n`;
    briefingText += `Capacity Load: ${dailyScheduleStats.pax} Passengers | Jobs: ${dailyScheduleStats.total} Tours\n`;
    briefingText += `========================================\n\n`;

    targetDailyBookings.forEach((b, index) => {
      if (b.status === 'cancelled') return;
      briefingText += `${index + 1}. *[${b.time || 'Pending Departure Time'}]* - Ref: #${b.id.slice(-8)}\n`;
      briefingText += `   *Activity:* ${b.tourTitle}\n`;
      briefingText += `   *Pkg:* ${b.packageName}\n`;
      briefingText += `   *Customer:* ${b.customerData.fullName} (Seats: ${b.participants.adults}A, ${b.participants.children}C)\n`;
      briefingText += `   *WhatsApp:* +${b.customerData.phone}\n`;
      briefingText += `   *Pickup Address:* ${b.customerData.pickupAddress || 'No Address Provided'}\n`;
      briefingText += `   *Dispatch Crew:* ${b.assignedGuideName ? `✅ ${b.assignedGuideName} (+${b.assignedGuideWhatsapp})` : '🚨 UNASSIGNED - NEEDS ACTION'}\n`;
      briefingText += `   *Status:* ${b.status.toUpperCase()} | *Collect Value:* ${formatPrice(b.totalAmount)} (${b.paymentStatus === 'paid' ? 'PAID ✅' : 'COLLECT CASH 💵'})\n`;
      if (b.internalNotes) briefingText += `   *Logistics Note:* "${b.internalNotes}"\n`;
      briefingText += `\n`;
    });

    navigator.clipboard.writeText(briefingText);
    alert("📋 WhatsApp Courier Format Sheet copied to clipboard! Paste directly to driver or logistics channels.");
  };

  // Calendar Engine Grid Calculations
  const calendarMonthStart = startOfMonth(new Date(selectedYear + "-" + selectedMonth + "-15"));
  const calendarMonthEnd = endOfMonth(calendarMonthStart);
  const calendarWeekStart = startOfWeek(calendarMonthStart);
  const calendarWeekEnd = endOfWeek(calendarMonthEnd);

  const calendarDays = useMemo(() => {
    try {
      return eachDayOfInterval({
        start: calendarWeekStart,
        end: calendarWeekEnd,
      });
    } catch (e) {
      return [];
    }
  }, [calendarWeekStart, calendarWeekEnd]);

  const handleNextMonth = () => {
    const nextDate = addMonths(calendarMonthStart, 1);
    setSelectedYear(nextDate.getFullYear().toString());
    setSelectedMonth((nextDate.getMonth() + 1).toString().padStart(2, '0'));
  };

  const handlePrevMonth = () => {
    const prevDate = subMonths(calendarMonthStart, 1);
    setSelectedYear(prevDate.getFullYear().toString());
    setSelectedMonth((prevDate.getMonth() + 1).toString().padStart(2, '0'));
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear().toString());
    setSelectedMonth((today.getMonth() + 1).toString().padStart(2, '0'));
    setSelectedDay(today.getDate().toString().padStart(2, '0'));
  };

  const getBookingsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return bookings
      .filter(b => {
        if (currentUserProfile?.role === "supplier") {
          return b.supplierId === currentUserProfile.uid;
        }
        return true;
      })
      .filter(b => b.date === dayStr);
  };

  return (
    <div className="space-y-6 text-gray-800 font-sans">
      
      {/* Dynamic Filter / Search Panel Widget */}
      <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm space-y-4">
        
        {/* Core Header ViewMode Switchers */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Icons.LayoutDashboard className="h-5 w-5 text-primary" />
              Booking & Dispatch Console
            </h2>
            <p className="text-xs text-gray-400 font-medium">Simplify guest boarding lists, assign guides instantly, and perform bulk operations on {bookings.length} reservations.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 self-start xl:self-auto">
            <button
              onClick={() => { setViewMode('list'); setQuickShortcut('all'); }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === 'list' ? "bg-white text-orange-700 shadow-sm border border-gray-200" : "text-gray-400 hover:text-gray-650"
              )}
            >
              <Icons.List className="h-3.5 w-3.5" /> List grid view
            </button>
            <button
              onClick={() => { setViewMode('daily'); }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === 'daily' ? "bg-white text-orange-700 shadow-sm border border-gray-200" : "text-gray-400 hover:text-gray-650"
              )}
            >
              <Icons.Clock4 className="h-3.5 w-3.5" /> Daily schedule
            </button>
            <button
              onClick={() => { setViewMode('calendar'); }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === 'calendar' ? "bg-white text-orange-700 shadow-sm border border-gray-200" : "text-gray-400 hover:text-gray-650"
              )}
            >
              <Icons.CalendarDays className="h-3.5 w-3.5" /> Month grid calendar
            </button>
          </div>
        </div>

        {/* Search Input Filter */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search via Passenger Name, booking reference, WhatsApp phone, specific email, guide name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-50 outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full">
                <Icons.X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportToExcelFormat}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Icons.Download className="h-3.5 w-3.5 text-blue-500" /> Excel/CSV export
            </button>
            <button
              onClick={triggerLandscapePrintPdf}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Icons.Printer className="h-3.5 w-3.5 text-orange-400" /> Print manifest PDF
            </button>
          </div>
        </div>

        {/* Complex Time frame breakdown filters for easy Year/Month/Day targeting */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 pt-3 border-t border-gray-50">
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Date targeting rules</label>
            <select
              value={dateFilterType}
              onChange={e => setDateFilterType(e.target.value as any)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="tour">✈️ Tour departure date</option>
              <option value="booked">📅 Booking created date</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Select year</label>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(e.target.value); setQuickShortcut('all'); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">🗓️ All years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Select month</label>
            <select
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setQuickShortcut('all'); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">🌙 All months</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{format(new Date(`2026-${m}-15`), 'MMMM')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Select specific day</label>
            <select
              value={selectedDay}
              onChange={e => { setSelectedDay(e.target.value); setQuickShortcut('all'); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">☀️ All days</option>
              {Array.from({ length: 31 }).map((_, i) => {
                const dayVal = (i + 1).toString().padStart(2, '0');
                return <option key={dayVal} value={dayVal}>Day {i + 1}</option>;
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Quick timeline shortcuts</label>
            <select
              value={quickShortcut}
              onChange={e => { setQuickShortcut(e.target.value); if (e.target.value !== 'all') { setCustomRange({ start: '', end: '' }); setSelectedDay('all'); } }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">⚡ Dynamic filter on</option>
              <option value="today">Today operations</option>
              <option value="tomorrow">Tomorrow operations</option>
              <option value="this_month">Whole current month</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Booking status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-orange-700 font-semibold"
            >
              <option value="all">🟢 All status</option>
              <option value="pending">🟡 Pending status</option>
              <option value="confirmed">🟢 Confirmed status</option>
              <option value="completed">🔵 Completed status</option>
              <option value="cancelled">🔴 Cancelled status</option>
            </select>
          </div>
        </div>

        {/* Additional Custom Range inputs, Guide state, Source Filters, and Tour Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          
          <div className="space-y-1 col-span-1">
            <label className="text-xs font-semibold text-gray-500">Tour filter</label>
            <select
              value={filterTourId}
              onChange={e => setFilterTourId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">🗺️ All tours</option>
              {tourOptions.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Guide assignment</label>
            <select
              value={filterGuideState}
              onChange={e => setFilterGuideState(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">🧑‍🔧 All assignments</option>
              <option value="assigned">✅ Assigned guides only</option>
              <option value="unassigned">🚨 Unassigned vacancies</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Booking source</label>
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none text-gray-700"
            >
              <option value="all">💼 All channels</option>
              <option value="Direct">Direct bookings</option>
              <option value="Klook">Klook API</option>
              <option value="Viator">Viator API</option>
              <option value="GetYourGuide">GetYourGuide API</option>
              <option value="Manual">Manual insert</option>
              <option value="Agent">External agents</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 col-span-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Start date</label>
              <input
                type="date"
                value={customRange.start}
                onChange={e => { setCustomRange(p => ({ ...p, start: e.target.value })); setQuickShortcut('all'); }}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none text-gray-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">End date</label>
              <input
                type="date"
                value={customRange.end}
                onChange={e => { setCustomRange(p => ({ ...p, end: e.target.value })); setQuickShortcut('all'); }}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none text-gray-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate stats dashboard card strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white px-4 py-3 border border-gray-100 rounded-xl shadow-sm text-center lg:text-left">
          <p className="text-xs font-semibold text-gray-400 mb-1">Reservation count</p>
          <p className="text-xl font-bold text-gray-900 leading-tight">{stats.total} Booked</p>
        </div>
        <div className="bg-white px-4 py-3 border border-gray-100 rounded-xl shadow-sm text-center lg:text-left">
          <p className="text-xs font-semibold text-gray-400 mb-1">Total capacity sum</p>
          <p className="text-xl font-bold text-blue-600 leading-tight">{stats.pax} Pax Base</p>
        </div>
        <div className="bg-white px-4 py-3 border border-gray-100 rounded-xl shadow-sm text-center lg:text-left">
          <p className="text-xs font-semibold text-gray-400 mb-1">Unassigned vacancies</p>
          <p className="text-xl font-bold text-amber-600 leading-tight">{stats.unassigned} Pending</p>
        </div>
        <div className="bg-white px-4 py-3 border border-gray-100 rounded-xl shadow-sm text-center lg:text-left col-span-2 lg:col-span-2">
          <p className="text-xs font-semibold text-gray-400 mb-1">Confirmed / settled volume</p>
          <p className="text-xl font-bold text-green-600 font-mono leading-tight">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Multi-Select Bulk Actions Bar (slides up) */}
      {selectedIds.length > 0 && (
        <div className="bg-orange-950 text-white rounded-[16px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300 shadow-xl border border-orange-900 sticky bottom-4 z-40">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-orange-700 text-white font-bold text-xs flex items-center justify-center">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold leading-none">Selected bookings</p>
              <p className="text-[10px] text-orange-300 font-medium mt-1">Perform bulk actions in 1 click across selected scope.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => executeBulkStatusChange('confirmed')}
              className="px-3 py-1.5 bg-orange-700 hover:bg-primary text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              disabled={isBulkProcessing}
            >
              Bulk Confirm ✅
            </button>
            <button
              onClick={() => executeBulkStatusChange('cancelled')}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-750 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              disabled={isBulkProcessing}
            >
              Bulk Cancel ❌
            </button>
            <button
              onClick={() => executeBulkStatusChange('completed')}
              className="px-3 py-1.5 bg-blue-800 hover:bg-blue-750 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              disabled={isBulkProcessing}
            >
              Bulk Complete 🔵
            </button>

            {currentUserProfile?.role === 'admin' && (
              <button
                onClick={executeBulkDelete}
                className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                disabled={isBulkProcessing}
              >
                Bulk Delete 🗑️
              </button>
            )}

            <div className="h-6 w-px bg-orange-800 hidden md:block" />

            <div className="flex items-center gap-1">
              <select
                value={bulkGuide}
                onChange={e => setBulkGuide(e.target.value)}
                className="bg-orange-900 border border-orange-800 text-white text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="">-- Bulk assign guide --</option>
                {guides.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={executeBulkGuideAssign}
                className="p-1 px-2.5 bg-primary hover:bg-orange-500 rounded-lg text-xs font-bold transition-all"
                disabled={!bulkGuide || isBulkProcessing}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODES */}

      {/* 1. COMPACT LIST VIEW / TABLE SPREADSHEET */}
      {viewMode === 'list' && (
        <div className="bg-white border border-gray-100 rounded-[20px] overflow-hidden shadow-sm space-y-4">
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs bg-white min-w-[1100px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400">
                  <th className="p-3 pl-5 text-center w-[50px]">
                    <input
                      type="checkbox"
                      checked={paginatedList.length > 0 && paginatedList.every(b => selectedIds.includes(b.id))}
                      onChange={handleToggleSelectAll}
                      className="rounded text-primary focus:ring-orange-500 cursor-pointer h-4 w-4"
                    />
                  </th>
                  <th className="p-3 w-[150px]">Manifest Ref / Date</th>
                  <th className="p-3 w-[180px]">Primary Lead Customer</th>
                  <th className="p-3">Tour Segment / Activity Package</th>
                  <th className="p-3 text-center w-[110px]">Pax Headcount</th>
                  <th className="p-3 text-right w-[110px]">Collect Price</th>
                  <th className="p-3 w-[130px]">Source</th>
                  <th className="p-3 w-[150px]">Dispatch Status</th>
                  <th className="p-3 w-[180px]">Assigned Driver/Guide</th>
                  <th className="p-3 text-center w-[110px]">Details & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedList.map((booking) => {
                  const totalPassengers = (booking.participants?.adults || 0) + (booking.participants?.children || 0);
                  const isRowSelected = selectedIds.includes(booking.id);
                  const isRowSaving = savingRowId === booking.id;

                  return (
                    <tr 
                      key={booking.id} 
                      className={cn(
                        "hover:bg-gray-50/70 transition-colors group cursor-pointer font-sans text-xs",
                        isRowSelected && "bg-orange-50/[0.12] hover:bg-orange-50/[0.18]"
                      )}
                      onClick={() => {
                        setGlobalSelectedBooking(booking);
                        setOriginalBooking(booking);
                        setIsBookingDetailOpen(true);
                      }}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => handleSelectRow(booking.id, e)}
                          className="rounded text-primary focus:ring-orange-500 cursor-pointer h-4 w-4"
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[10px] font-bold text-primary select-all">
                            #{booking.id.slice(-8)}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {booking.date}
                          </span>
                          {booking.time && (
                            <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                              <Icons.Clock className="h-3 w-3" /> {booking.time}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 tracking-tight leading-tight select-all">
                            {booking.customerData.fullName}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold select-all">
                            {booking.customerData.email}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold select-all">
                            +{booking.customerData.phone}
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="max-w-[280px]">
                          <span className="font-black text-gray-900 block truncate group-hover:text-orange-700 leading-tight">
                            {booking.tourTitle}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 block mt-0.5">
                            {booking.packageName}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="inline-block bg-gray-100 px-2 py-1 rounded-md text-center max-w-fit">
                          <span className="font-black text-gray-800 block text-xs md:text-xs">
                            {totalPassengers} Pax
                          </span>
                          <span className="text-[8px] text-gray-400 font-bold block whitespace-nowrap">
                            ({booking.participants?.adults || 0} A, {booking.participants?.children || 0} C)
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <div className="font-mono font-black text-gray-900">
                          {formatPrice(booking.totalAmount)}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium text-right block capitalize">
                          {(booking.paymentMethod || 'manual').replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={cn(
                          "inline-block px-2.5 py-0.5 rounded-md text-[10px] font-medium border",
                          booking.bookingSource === 'Klook' ? "bg-orange-50 text-orange-600 border-orange-100" :
                          booking.bookingSource === 'Viator' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          booking.bookingSource === 'GetYourGuide' ? "bg-red-50 text-red-600 border-red-100" :
                          booking.bookingSource === 'Manual' ? "bg-purple-50 text-purple-600 border-purple-100" :
                          booking.bookingSource === 'Agent' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          "bg-orange-50 text-primary border-orange-100"
                        )}>
                          {booking.bookingSource || 'Direct'}
                        </span>
                      </td>

                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          {isRowSaving ? (
                            <div className="flex items-center gap-1 text-primary text-[10px] font-bold">
                              <Icons.Loader2 className="animate-spin h-3.5 w-3.5" /> Syncing...
                            </div>
                          ) : (
                            <select
                              value={booking.status}
                              onChange={e => handleQuickStatusUpdate(booking, e.target.value)}
                              className={cn(
                                "w-full rounded-lg px-2 py-1.5 text-[10px] font-semibold border outline-none cursor-pointer",
                                booking.status === 'confirmed' ? "bg-orange-50 text-orange-700 border-emerald-250" :
                                booking.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-250" :
                                booking.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-250" :
                                "bg-amber-50 text-amber-700 border-amber-250"
                              )}
                            >
                              <option value="pending">🟡 Pending</option>
                              <option value="confirmed">🟢 Confirmed</option>
                              <option value="completed">💙 Completed</option>
                              <option value="cancelled">🔴 Cancelled</option>
                            </select>
                          )}
                        </div>
                      </td>

                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        {booking.status === 'cancelled' ? (
                          <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-1.5 rounded-lg block text-center">
                            Tour Cancelled
                          </span>
                        ) : isRowSaving ? (
                          <div className="flex items-center justify-center text-[10px] font-bold text-gray-400">
                            Updating...
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              value={booking.assignedGuideId || ''}
                              onChange={e => handleQuickAssignGuide(booking, e.target.value)}
                              className={cn(
                                "w-full rounded-lg pl-2 pr-6 py-1.5 text-[10px] font-bold border outline-none cursor-pointer appearance-none bg-no-repeat bg-[right_6px_center]",
                                booking.assignedGuideId ? "bg-green-50/70 text-green-800 border-green-250" : "bg-red-50/50 text-red-800 border-red-200"
                              )}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`,
                                backgroundSize: '10px'
                              }}
                            >
                              <option value="">🚨 No Driver/Guide Assigned</option>
                              {guides.map(g => (
                                <option key={g.id} value={g.id}>
                                  👤 {g.name} ({g.whatsapp || 'No WhatsApp'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setGlobalSelectedBooking(booking);
                              setOriginalBooking(booking);
                              setIsBookingDetailOpen(true);
                            }}
                            className="p-2 hover:bg-orange-50 text-gray-600 hover:text-orange-700 rounded-lg border border-gray-150 transition-colors"
                            title="Manage Logs & Details"
                          >
                            <Icons.ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                          
                          {currentUserProfile?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg border border-gray-150 transition-colors"
                              title="Delete Permanently"
                            >
                              <Icons.Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-16 text-center text-gray-400 font-bold uppercase tracking-widest bg-gray-50/10">
                      No matching reservations recorded in this layout framework
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Simple and elegant Paginator Footer */}
          {filteredBookings.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 font-black uppercase tracking-wider block">Show Page Depth</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 font-bold outline-none text-gray-700"
                >
                  <option value={25}>25 Rows</option>
                  <option value={50}>50 Rows</option>
                  <option value={100}>100 Rows</option>
                  <option value={250}>250 Rows</option>
                  <option value={500}>500 Rows</option>
                </select>
                <span className="text-gray-400 font-bold block whitespace-nowrap">
                  Showing {Math.min(filteredBookings.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredBookings.length, currentPage * pageSize)} of {filteredBookings.length} total bookings
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-gray-500">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                  title="First Page"
                >
                  « First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-3 py-1 bg-gray-100 text-orange-800 rounded-md">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                  title="Last Page"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. CHRONOLOGICAL OPERATIONS DAILY SCHEDULE / DISPATCH */}
      {viewMode === 'daily' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Daily Schedule Navigation Strip */}
          <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTargetDailyDate(format(addDays(parseISO(targetDailyDate), -1), 'yyyy-MM-dd'))}
                className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
              >
                <Icons.ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-base font-bold text-gray-900 min-w-[200px] text-center">
                📆 {format(parseISO(targetDailyDate), 'EEEE, d MMMM yyyy')}
              </h3>
              <button
                onClick={() => setTargetDailyDate(format(addDays(parseISO(targetDailyDate), 1), 'yyyy-MM-dd'))}
                className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
              >
                <Icons.ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={targetDailyDate}
                onChange={e => setTargetDailyDate(e.target.value)}
                className="bg-white border border-gray-250 rounded-lg px-3 py-2 text-xs font-black outline-none block text-gray-700"
              />
              <button
                onClick={() => setTargetDailyDate(format(new Date(), 'yyyy-MM-dd'))}
                className="px-3.5 py-2 hover:bg-gray-50 border border-gray-250 font-semibold text-xs rounded-lg transition-colors text-gray-650 cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleCopyWhatsappBriefing}
                className="px-4 py-2 bg-primary hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Icons.Copy className="h-3.5 w-3.5" /> Copy Dispatch Note
              </button>
            </div>
          </div>

          {/* Daily level dispatch aggregations card info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border p-3 rounded-xl border-gray-100">
              <p className="text-xs font-semibold text-gray-400">Total tours today</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{dailyScheduleStats.total} Runs</p>
            </div>
            <div className="bg-white border p-3 rounded-xl border-gray-100">
              <p className="text-xs font-semibold text-gray-400">Passenger volume</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">{dailyScheduleStats.pax} Guests</p>
            </div>
            <div className="bg-white border p-3 rounded-xl border-green-100 bg-green-50/5">
              <p className="text-xs font-semibold text-green-600">Dispatched crews</p>
              <p className="text-xl font-bold text-green-700 mt-0.5">{dailyScheduleStats.assigned} Guides</p>
            </div>
            <div className="bg-white border p-3 rounded-xl border-amber-100 bg-amber-50/5">
              <p className="text-xs font-semibold text-amber-600">Remaining vacancies</p>
              <p className="text-xl font-bold text-amber-700 mt-0.5">{dailyScheduleStats.unassigned} Vacant</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {targetDailyBookings.map((b) => {
              const paxCount = (b.participants?.adults || 0) + (b.participants?.children || 0);
              const isUrgentUnassigned = b.status !== 'cancelled' && !b.assignedGuideId;

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setGlobalSelectedBooking(b);
                    setOriginalBooking(b);
                    setIsBookingDetailOpen(true);
                  }}
                  className={cn(
                    "bg-white rounded-[16px] border p-4 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group",
                    b.status === 'cancelled' ? "border-red-150 opacity-60" :
                    isUrgentUnassigned ? "border-amber-400 bg-amber-50/[0.08] hover:border-amber-500" :
                    "border-gray-150 hover:border-orange-500"
                  )}
                >
                  <div className="space-y-2.5">
                    
                    {/* Departure Slot Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Icons.Clock className="h-4 w-4 text-primary" />
                        <span className="font-black text-gray-900 text-sm">{b.time || "Clock Pending"}</span>
                      </div>
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize",
                        b.status === 'confirmed' ? "bg-orange-50 text-orange-700 border-orange-100" :
                        b.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-100" :
                        b.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        {b.status}
                      </span>
                    </div>

                    {/* Booking Title */}
                    <div>
                      <span className="font-mono text-[9px] font-bold text-gray-400">Ref: #{b.id.slice(-8)}</span>
                      <h4 className="font-extrabold text-sm text-gray-900 group-hover:text-orange-700 transition-colors line-clamp-2 mt-0.5">
                        {b.tourTitle}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {b.packageName}
                      </p>
                    </div>

                    {/* Customer Info segment */}
                    <div className="bg-gray-50/60 p-2.5 rounded-lg border border-gray-100 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold text-[10px]">Guest Lead</span>
                        <span className="font-black text-gray-800 text-right max-w-[150px] truncate">{b.customerData.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold text-[10px]">Passenger Load</span>
                        <span className="font-black text-primary font-mono">{paxCount} Seats ({b.participants?.adults}A, {b.participants?.children}C)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold text-[10px]">Phone / Contact</span>
                        <span className="font-bold text-gray-655 select-all text-[10px] truncate">+{b.customerData.phone}</span>
                      </div>
                    </div>

                    {b.customerData.pickupAddress && (
                      <div className="text-[10px] font-bold text-gray-500 flex items-start gap-1 p-1">
                        <Icons.MapPin className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">Pickup: {b.customerData.pickupAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Guide Assignment Section inside Row */}
                  <div className="pt-2 border-t border-gray-50" onClick={e => e.stopPropagation()}>
                    {b.status === 'cancelled' ? (
                      <div className="bg-red-50 text-red-700 text-xs font-bold py-2 rounded-lg text-center">
                        Trip Cancelled
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-500">Assigned Driver/Guide</label>
                          {b.assignedGuideId ? (
                            <span className="text-[10px] font-semibold text-primary bg-orange-50 px-1.5 py-0.5 rounded">Dispatched</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Needs Assignment</span>
                          )}
                        </div>
                        <select
                          value={b.assignedGuideId || ''}
                          onChange={e => handleQuickAssignGuide(b, e.target.value)}
                          className={cn(
                            "w-full rounded-lg px-2.5 py-1.5 text-xs font-bold border outline-none cursor-pointer tracking-tight",
                            b.assignedGuideId ? "bg-green-50 text-green-800 border-green-250" : "bg-red-50/50 text-red-700 border-red-200"
                          )}
                        >
                          <option value="">🚨 -- Assign Driver/Guide --</option>
                          {guides.map(g => (
                            <option key={g.id} value={g.id}>👤 {g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {targetDailyBookings.length === 0 && (
              <div className="col-span-full py-20 text-center bg-gray-50/20 border border-gray-150 border-dashed rounded-2xl">
                <Icons.Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 font-semibold text-xs text-center">No active departures scheduled for this day</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MONTHLY SCHEDULE CALENDAR IN COMBINATION WITH DROP DOWNS */}
      {viewMode === 'calendar' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="bg-white border border-gray-100 rounded-[20px] p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrevMonth} 
                  className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
                >
                  <Icons.ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="text-base font-bold text-gray-900 min-w-[200px] text-center">
                  🌙 {format(calendarMonthStart, 'MMMM yyyy')}
                </h3>
                <button 
                  onClick={handleNextMonth} 
                  className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
                >
                  <Icons.ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-primary hover:bg-orange-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Icons.Calendar className="h-3.5 w-3.5" /> Back to today
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-gray-150 border border-gray-150 shadow-inner">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-gray-50 py-2.5 text-center">
                  <span className="text-xs font-semibold text-gray-500">{day}</span>
                </div>
              ))}
              
              {calendarDays.map((day, idx) => {
                const dayBookings = getBookingsForDay(day);
                const isSelected = isSameDay(day, new Date(selectedYear + "-" + selectedMonth + "-" + selectedDay));
                const isCurrentMonth = isSameMonth(day, calendarMonthStart);
                const totalPaxCount = dayBookings.reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);

                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      setSelectedDay(format(day, 'dd'));
                      setSelectedMonth(format(day, 'MM'));
                      setSelectedYear(format(day, 'yyyy'));
                      setViewMode('list'); // Jump straight into target listings!
                    }}
                    className={cn(
                      "min-h-[100px] bg-white p-2.5 transition-all cursor-pointer relative flex flex-col justify-between hover:bg-orange-50/[0.05]",
                      !isCurrentMonth && "bg-gray-50/15 text-gray-300",
                      isToday(day) && "bg-orange-50/[0.04]"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span className={cn(
                        "text-xs font-black transition-colors",
                        !isCurrentMonth ? "text-gray-300" : isToday(day) ? "text-primary font-black text-sm" : "text-gray-650",
                        isSelected && "text-orange-700"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayBookings.length > 0 && isCurrentMonth && (
                        <span className={cn(
                          "flex h-2 w-2 rounded-full",
                          dayBookings.some(b => b.status === 'pending') ? "bg-amber-500 animate-pulse" : "bg-orange-500"
                        )} />
                      )}
                    </div>

                    {dayBookings.length > 0 && isCurrentMonth && (
                      <div className="space-y-0.5">
                        <div className="text-[9px] font-black text-gray-900 leading-none">
                          {dayBookings.length} Tours
                        </div>
                        <div className="text-[8px] font-bold text-gray-400 flex items-center gap-0.5 whitespace-nowrap">
                          <Icons.Users className="h-2 w-2 text-blue-400" />
                          {totalPaxCount} Pax
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
