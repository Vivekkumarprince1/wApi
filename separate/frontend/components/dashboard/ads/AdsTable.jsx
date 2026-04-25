import { FaPlus, FaPause, FaPlay, FaTrash, FaEye } from 'react-icons/fa';

export default function AdsTable({ ads, onResumeAd, onPauseAd, onViewAd, onDeleteAd, getStatusBadgeColor }) {
  if (ads.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Budget</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Spent</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Impressions</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad._id} className="border-b border-border hover:bg-muted">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{ad.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(ad.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(ad.status)}`}>
                    {ad.status.replace('_', ' ').toUpperCase()}
                  </span>
                  {ad.pausedReason && (
                    <p className="text-xs text-muted-foreground mt-1">{ad.pausedReason}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-foreground">
                  ${(ad.budget / 100).toFixed(2)}/day
                </td>
                <td className="px-6 py-4 text-foreground">
                  ${(ad.spentAmount / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-foreground">
                  {ad.impressions.toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {ad.status === 'paused' ? (
                      <button
                        onClick={() => onResumeAd(ad._id, ad.name)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                        title="Resume"
                      >
                        <FaPlay size={16} />
                      </button>
                    ) : ad.status === 'active' ? (
                      <button
                        onClick={() => onPauseAd(ad._id, ad.name)}
                        className="p-2 text-yellow-600 hover:bg-yellow-100 rounded transition"
                        title="Pause"
                      >
                        <FaPause size={16} />
                      </button>
                    ) : null}
                    
                    <button
                      onClick={() => onViewAd(ad._id)}
                      className="p-2 text-muted-foreground hover:bg-accent rounded transition"
                      title="View"
                    >
                      <FaEye size={16} />
                    </button>
                    
                    {ad.status === 'draft' && (
                      <button
                        onClick={() => onDeleteAd(ad._id, ad.name)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                        title="Delete"
                      >
                        <FaTrash size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
