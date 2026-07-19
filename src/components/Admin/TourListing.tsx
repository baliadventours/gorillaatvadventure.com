import React, { useState } from 'react';
import { Plus, Copy, Edit2, Trash2, LayoutGrid, List } from 'lucide-react';
import { Tour, Category } from '../../types';
import { cn } from '../../lib/utils';

interface TourListingProps {
  tours: Tour[];
  categories: Category[];
  handleEdit: (tour: Tour) => void;
  handleDelete: (id: string) => Promise<void>;
  handleCloneTour: (tour: Tour) => void;
  resetForm: () => void;
  setActiveMenu: (menu: any) => void;
}

const TourListing = ({
  tours,
  categories,
  handleEdit,
  handleDelete,
  handleCloneTour,
  resetForm,
  setActiveMenu
}: TourListingProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Tour Catalog</h1>
          <p className="text-gray-500 font-medium">Manage and monitor all your live adventures.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-100 p-1 rounded-[10px] flex gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-[7px] transition-all",
                viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-[7px] transition-all",
                viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button 
            onClick={() => { resetForm(); setActiveMenu('tours'); }} 
            className="bg-primary text-white px-6 py-3 rounded-[10px] font-black text-xs flex items-center gap-2 shadow-lg shadow-orange-200"
          >
            <Plus className="h-4 w-4" /> Add New Tour
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tours.map(tour => (
            <div key={tour.id} className="group relative overflow-hidden rounded-[10px] border border-gray-100 bg-white transition-all hover:shadow-2xl">
              <div className="aspect-[4/3] w-full overflow-hidden relative">
                <img 
                  src={tour.gallery?.[0] || "https://picsum.photos/seed/placeholder/400/300"} 
                  alt="" 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <button 
                    onClick={() => handleCloneTour(tour)} 
                    className="p-3 bg-white/90 backdrop-blur rounded-[10px] text-primary shadow-xl hover:bg-primary hover:text-white transition-all" 
                    title="Clone Tour"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleEdit(tour)} 
                    className="p-3 bg-white/90 backdrop-blur rounded-[10px] text-blue-600 shadow-xl hover:bg-blue-600 hover:text-white transition-all" 
                    title="Edit Tour"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(tour.id)} 
                    className="p-3 bg-white/90 backdrop-blur rounded-[10px] text-red-600 shadow-xl hover:bg-red-600 hover:text-white transition-all" 
                    title="Delete Tour"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-orange-50 text-primary text-[10px] font-black rounded-full">
                    {categories.find(c => c.id === tour.categoryId)?.name || 'General'}
                  </span>
                  {tour.status && (
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                      tour.status === 'published' ? "bg-orange-50 text-primary" :
                      tour.status === 'pending' ? "bg-amber-50 text-amber-600" :
                      tour.status === 'draft' ? "bg-gray-100 text-gray-500" :
                      "bg-red-50 text-red-600"
                    )}>
                      {tour.status}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg group-hover:text-primary transition-colors">{tour.title}</h3>
                {tour.supplierName && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Vendor: {tour.supplierName}</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-gray-400 tracking-tighter">Starts From</span>
                     <span className="text-xl font-black text-primary tracking-tight">${tour.discountPrice || tour.regularPrice}</span>
                  </div>
                  <div className="text-right">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter block">Duration</span>
                     <span className="text-sm font-black text-gray-900">{tour.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[10px] border border-gray-100 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tour Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Price</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tours.map(tour => (
                <tr key={tour.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src={tour.gallery?.[0] || "https://picsum.photos/seed/placeholder/400/300"} 
                          className="h-full w-full object-cover"
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-primary transition-colors">{tour.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{tour.duration}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-gray-600 px-3 py-1 bg-gray-100 rounded-full">
                      {categories.find(c => c.id === tour.categoryId)?.name || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest",
                      tour.status === 'published' ? "bg-orange-50 text-primary" :
                      tour.status === 'pending' ? "bg-amber-50 text-amber-600" :
                      tour.status === 'draft' ? "bg-gray-100 text-gray-500" :
                      "bg-red-50 text-red-600"
                    )}>
                      {tour.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {tour.supplierName || '-'}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="text-sm font-black text-primary">${tour.discountPrice || tour.regularPrice}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => handleCloneTour(tour)} className="p-2 text-primary hover:bg-orange-50 rounded-lg transition-all" title="Clone"><Copy className="h-4 w-4" /></button>
                       <button onClick={() => handleEdit(tour)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"><Edit2 className="h-4 w-4" /></button>
                       <button onClick={() => handleDelete(tour.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TourListing;
