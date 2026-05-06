"use client";

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw, 
  Filter, 
  Table as TableIcon, 
  Eye, 
  Edit, 
  Code,
  ArrowLeft,
  SearchCode,
  HardDrive
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DataInspectionModal from '@/components/super-admin/DataInspectionModal';

export default function DataExplorerPage() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [filter, setFilter] = useState('{}');
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  
  // Modal State
  const [inspectionState, setInspectionState] = useState<{
    isOpen: boolean;
    document: any;
    mode: 'view' | 'edit';
  }>({
    isOpen: false,
    document: null,
    mode: 'view'
  });

  const { data: collections, isLoading: loadingCollections } = useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: async () => {
      const resp = await apiClient.get('/super-admin/data/collections');
      return (resp.data || []).sort();
    }
  });

  const { data: documentsData, isLoading: loadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['admin', 'documents', selectedCollection, filter, skip, limit],
    queryFn: async () => {
      if (!selectedCollection) return null;
      const resp = await apiClient.get(`/super-admin/data/collections/${selectedCollection}`, {
        params: { filter, skip, limit }
      });
      return resp;
    },
    enabled: !!selectedCollection
  });

  const filteredCollections = collections?.filter((c: string) => 
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCollectionSelect = (c: string) => {
    setSelectedCollection(c);
    setSkip(0);
    setFilter('{}');
  };

  const applyFilter = () => {
    try {
      JSON.parse(filter);
      setSkip(0);
      refetchDocs();
    } catch (e) {
      toast.error("Invalid JSON filter");
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter animate-in slide-in-from-bottom-4 duration-700">
      <SuperAdminPageHeader
        icon={Database}
        eyebrow="Database"
        title="Direct Data Explorer"
        subtitle="Low-level access to all MongoDB collections. View, filter, and inspect raw documents across the entire platform."
        actions={(
          <Button 
            variant="outline" 
            className="rounded-2xl border-slate-200 hover:bg-slate-50 font-black tracking-widest text-[10px] uppercase h-12 px-6"
            onClick={() => window.location.href = '/super-admin/infrastructure'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Infra
          </Button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Collection Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200/50 flex flex-col gap-6 sticky top-8 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black tracking-widest text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                <SearchCode className="h-3 w-3" /> Collections
              </h3>
              <Badge variant="secondary" className="text-[9px] font-black">{collections?.length || 0}</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                placeholder="Search collections..." 
                className="pl-10 h-10 rounded-xl bg-slate-50/50 border-none text-xs font-medium"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
              {loadingCollections ? (
                Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl mb-1" />)
              ) : (
                filteredCollections?.map((c: string) => (
                  <button
                    key={c}
                    onClick={() => handleCollectionSelect(c)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left group",
                      selectedCollection === c 
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                        : "hover:bg-slate-100/80 text-slate-600"
                    )}
                  >
                    <span className="text-[11px] font-bold truncate">{c}</span>
                    <ChevronRight className={cn(
                      "h-3 w-3 opacity-0 group-hover:opacity-100 transition-all",
                      selectedCollection === c && "opacity-100"
                    )} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Data View */}
        <div className="lg:col-span-9 space-y-6">
          {!selectedCollection ? (
            <div className="glass-card h-[600px] rounded-[3rem] border border-dashed border-slate-300 flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="p-6 bg-slate-50 rounded-[2rem]">
                <TableIcon className="h-12 w-12 text-slate-300" />
              </div>
              <div>
                <h4 className="font-manrope text-xl font-black tracking-tight text-slate-400 uppercase">Select a Collection</h4>
                <p className="text-xs text-slate-400 font-medium max-w-[300px] mt-2 leading-relaxed">
                  Choose a MongoDB collection from the sidebar to start exploring raw system data.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-[3rem] border border-slate-200/50 flex flex-col overflow-hidden bg-white shadow-xl shadow-slate-200/20">
              {/* Header / Toolbar */}
              <div className="p-8 border-b border-slate-100 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-2xl">
                      <HardDrive className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-manrope text-xl font-black tracking-tight">{selectedCollection}</h3>
                      <p className="text-xs text-muted-foreground font-medium">Browsing raw records from the production cluster.</p>
                    </div>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button 
                      onClick={() => setViewMode('table')}
                      className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'table' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                    >
                      Table
                    </button>
                    <button 
                      onClick={() => setViewMode('json')}
                      className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'json' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 relative group">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      placeholder='Mongo Filter: {"status": "active"}' 
                      className="pl-12 h-12 rounded-[1.25rem] bg-slate-50 border-none font-mono text-xs focus:ring-emerald-500/20"
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black tracking-widest text-[10px] uppercase shadow-lg shadow-slate-900/20"
                    onClick={applyFilter}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>

              {/* Data Display */}
              <div className="min-h-[500px] relative overflow-hidden">
                {loadingDocs ? (
                  <div className="p-8 space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                  </div>
                ) : documentsData?.data?.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Search className="h-8 w-8 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest">No documents found</span>
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">_id</th>
                          {documentsData?.data?.[0] && Object.keys(documentsData.data[0]).filter(k => k !== '_id').slice(0, 5).map(k => (
                            <th key={k} className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">{k}</th>
                          ))}
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentsData?.data?.map((doc: any) => (
                          <tr key={doc._id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5 border-b border-slate-50">
                              <span className="font-mono text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{doc._id}</span>
                            </td>
                            {Object.keys(doc).filter(k => k !== '_id').slice(0, 5).map(k => (
                              <td key={k} className="px-8 py-5 border-b border-slate-50 max-w-[200px] truncate">
                                <span className="text-xs font-medium text-slate-600">
                                  {typeof doc[k] === 'object' ? '{...}' : String(doc[k])}
                                </span>
                              </td>
                            ))}
                             <td className="px-8 py-5 border-b border-slate-50 text-right">
                               <div className="flex justify-end gap-2">
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-lg border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                   onClick={() => setInspectionState({ isOpen: true, document: doc, mode: 'view' })}
                                 >
                                   <Eye className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-lg border-slate-200 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                   onClick={() => setInspectionState({ isOpen: true, document: doc, mode: 'edit' })}
                                 >
                                   <Edit className="h-3.5 w-3.5" />
                                 </Button>
                               </div>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <pre className="p-8 bg-slate-900 rounded-[2rem] text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto shadow-inner">
                      {JSON.stringify(documentsData?.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing {skip + 1}-{Math.min(skip + limit, documentsData?.pagination?.total || 0)} of {documentsData?.pagination?.total || 0} documents
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 w-10 p-0 border-slate-200"
                    disabled={skip === 0}
                    onClick={() => setSkip(Math.max(0, skip - limit))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 w-10 p-0 border-slate-200"
                    disabled={skip + limit >= (documentsData?.pagination?.total || 0)}
                    onClick={() => setSkip(skip + limit)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DataInspectionModal 
        isOpen={inspectionState.isOpen}
        onClose={() => setInspectionState(prev => ({ ...prev, isOpen: false }))}
        collection={selectedCollection || ''}
        document={inspectionState.document}
        mode={inspectionState.mode}
      />
    </div>
  );
}
