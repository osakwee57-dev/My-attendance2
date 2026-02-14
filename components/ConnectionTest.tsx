
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { TableStatus } from '../types';
import { CheckCircle, XCircle, RefreshCw, Database, Users, Calendar, ClipboardCheck } from 'lucide-react';

export const ConnectionTest: React.FC = () => {
  const [statuses, setStatuses] = useState<TableStatus[]>([
    { name: 'profiles', count: null, status: 'loading' },
    { name: 'active_sessions', count: null, status: 'loading' },
    { name: 'attendance', count: null, status: 'loading' },
  ]);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnectivity = async () => {
    setIsRetrying(true);
    
    const checkTable = async (tableName: string): Promise<TableStatus> => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) throw error;

        return {
          name: tableName,
          count: count ?? 0,
          status: 'success'
        };
      } catch (err: any) {
        console.error(`Error connecting to ${tableName}:`, err);
        return {
          name: tableName,
          count: null,
          status: 'error',
          error: err.message || 'Unknown error'
        };
      }
    };

    const results = await Promise.all([
      checkTable('profiles'),
      checkTable('active_sessions'),
      checkTable('attendance')
    ]);

    setStatuses(results);
    setIsRetrying(false);
  };

  useEffect(() => {
    checkConnectivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case 'profiles': return <Users className="w-6 h-6" />;
      case 'active_sessions': return <Calendar className="w-6 h-6" />;
      case 'attendance': return <ClipboardCheck className="w-6 h-6" />;
      default: return <Database className="w-6 h-6" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Database Connection Test</h2>
            <p className="text-gray-500 mt-1">Verifying access to your Supabase tables</p>
          </div>
          <button
            onClick={checkConnectivity}
            disabled={isRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg transition-all font-medium shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statuses.map((item) => (
            <div
              key={item.name}
              className={`relative overflow-hidden p-6 rounded-xl border-2 transition-all ${
                item.status === 'success'
                  ? 'border-green-100 bg-green-50/30 dark:bg-green-900/10'
                  : item.status === 'error'
                  ? 'border-red-100 bg-red-50/30 dark:bg-red-900/10'
                  : 'border-gray-100 bg-gray-50/30 dark:bg-slate-700/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${
                  item.status === 'success' ? 'bg-green-100 text-green-700' :
                  item.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
                }`}>
                  {getIcon(item.name)}
                </div>
                {item.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {item.status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white capitalize">{item.name.replace('_', ' ')}</h3>
                <div className="mt-1">
                  {item.status === 'loading' ? (
                    <span className="text-sm text-gray-400">Connecting...</span>
                  ) : item.status === 'success' ? (
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-green-700 dark:text-green-500">{item.count}</span>
                      <span className="text-xs text-green-600 uppercase tracking-wider font-semibold">Records Found</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm text-red-600 font-medium">Connection Failed</span>
                      <p className="text-[10px] text-red-400 mt-1 break-words line-clamp-2" title={item.error}>
                        {item.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg flex gap-3 border border-blue-100 dark:border-blue-900/30">
          <Database className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Project Details</h4>
            <code className="text-xs text-blue-700 dark:text-blue-400 block mt-1 break-all">
              URL: https://hydyzjdewhxexrzdrigu.supabase.co
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
