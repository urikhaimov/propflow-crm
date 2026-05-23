// Public thank-you page after lead form submission
export default function CaptureSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">קיבלנו את הפרטים!</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-2">
          נציג מטעמנו יצור אתכם קשר תוך שעה אחת.
        </p>
        <p className="text-slate-500 text-xs">
          אם אתם צריכים מענה מיידי, התקשרו אלינו ישירות.
        </p>
      </div>
    </div>
  )
}
