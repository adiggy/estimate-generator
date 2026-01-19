import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { Printer, Copy, Check, Palette, Layout, Smartphone, BarChart3, Shield, Zap, Megaphone, RefreshCw, PenTool, Plus, Trash2, ArrowLeft, FileText, Calendar, Percent } from 'lucide-react'

const API_BASE = 'http://localhost:3002/api'

const Logo = () => (
  <svg viewBox="0 0 508.8 94.3" className="h-10 w-auto">
    <defs>
      <linearGradient id="logo-grad" x1="47.1" y1="8" x2="47.1" y2="90.2" gradientTransform="translate(0 96.4) scale(1 -1)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#f69220"/>
        <stop offset="1" stopColor="#d72027"/>
      </linearGradient>
    </defs>
    <path fill="url(#logo-grad)" d="M47.1,94.2h0c14.8,0,28-6.8,36.7-17.5,4.4-5.7,7-14.3-2.8-24.4-11.5-11.8-32.9-29-33.9-29s-22.3,17.1-33.9,29c-9.8,10.1-7.2,18.7-2.8,24.4,8.6,10.7,21.9,17.6,36.7,17.6h0Z"/>
    <path fill="url(#logo-grad)" d="M47.1,12c2.4,0,25.1,18.3,47.1,36.5v-1.4C94.2,21.1,73.1,0,47.1,0h0C21.1,0,0,21.1,0,47.1s0,.9,0,1.4C22,30.4,44.7,12.1,47.1,12.1h0Z"/>
    <path fill="#6e0e0f" opacity="0.4" d="M81,52.3c-11.5-11.8-32.9-29-33.9-29s-22.3,17.1-33.9,29c-3.5,3.6-5.4,6.9-6.2,10.1,1.1-2.2,2.8-4.6,5.5-7.1,11.8-10.7,33.6-26.2,34.6-26.2s22.8,15.5,34.6,26.2c2.6,2.4,4.4,4.7,5.5,6.9-.9-3.1-2.7-6.4-6.2-9.9Z"/>
    <g fill="#2b303a">
      <path d="M135.2,25l3.2,8.7h-6.3l3.2-8.7h0ZM147.4,43l-8.6-23.2h-7.2l-8.6,23.2h5.7l1.6-4.4h9.8l1.6,4.4h5.7Z"/>
      <path d="M157.1,38v-13.3h5.1c3.1,0,5.5,2.5,5.5,6.6s-2.4,6.8-5.5,6.8h-5.1ZM151.6,19.7v23.2h10.7c6.6,0,11-4.9,11-11.6s-4.4-11.6-11-11.6h-10.7Z"/>
      <path d="M190.1,24.6c1.7,0,3.1,1.3,3.1,2.9s-1.3,3-3.3,3h-5.8v-5.9h6ZM199.3,43l-5.6-8.3c3.1-1.3,4.7-4.1,4.7-7.1s-3.1-7.8-8.2-7.8h-11.6v23.2h5.4v-7.6h4l4.9,7.6h6.4Z"/>
      <rect x="204.2" y="19.7" width="5.6" height="23.2"/>
      <path d="M226.2,25l3.2,8.7h-6.3l3.2-8.7h-.1ZM238.4,43l-8.6-23.2h-7.2l-8.6,23.2h5.7l1.6-4.4h9.8l1.6,4.4h5.7Z"/>
      <polygon points="248.1 19.7 242.6 19.7 242.6 43 259 43 259 37.9 248.1 37.9 248.1 19.7"/>
      <path d="M279.5,38v-13.3h5.1c3.1,0,5.5,2.5,5.5,6.6s-2.4,6.8-5.5,6.8h-5.1ZM274,19.7v23.2h10.7c6.6,0,11-4.9,11-11.6s-4.4-11.6-11-11.6h-10.7Z"/>
      <polygon points="318.5 19.7 301 19.7 301 43 318.5 43 318.5 38 306.4 38 306.4 33.6 316.8 33.6 316.8 28.8 306.4 28.8 306.4 24.7 318.5 24.7 318.5 19.7"/>
      <path d="M332.8,43.4c5.7,0,9.6-3.2,9.6-7.3s-2.9-5.5-6.3-6.6l-5.1-1.7c-1.3-.4-1.9-1-1.9-1.8s1.3-1.9,3.2-1.9,4.1,1.1,4.7,2.8l5.1-1.5c-.9-3.4-4.4-6.1-9.6-6.1s-9,3.1-9,6.9,2.3,5.1,5.3,6.1l5.8,1.9c1.5.5,2.2,1.2,2.2,2.2s-1.4,2.2-3.6,2.2-5-1.7-5.6-3.9l-5.2,1.6c.9,3.7,4.2,7.1,10.5,7.1h-.1Z"/>
      <rect x="347.6" y="19.7" width="5.6" height="23.2"/>
      <path d="M382.8,29.8h-11.9v4.7h6.1c-.4,1.9-2.3,3.8-5.6,3.8-4.9,0-7.4-3.4-7.4-7s2.7-6.9,6.7-6.9,5,1.4,6.1,3.5l5.1-1.5c-1.4-3.9-5.4-7.2-11.3-7.2s-12.2,5.2-12.2,12.1,5.3,12.1,12.5,12.1,11.8-4.6,11.8-10.9v-2.8h0Z"/>
      <polygon points="403 33 392.6 19.7 388.1 19.7 388.1 43 393.6 43 393.6 29.7 404 43 408.5 43 408.5 19.7 403 19.7 403 33"/>
      <path d="M424.2,43.4c5.7,0,9.6-3.2,9.6-7.3s-2.9-5.5-6.3-6.6l-5.1-1.7c-1.3-.4-1.9-1-1.9-1.8s1.3-1.9,3.2-1.9,4.1,1.1,4.7,2.8l5.1-1.5c-.9-3.4-4.4-6.1-9.6-6.1s-9,3.1-9,6.9,2.3,5.1,5.3,6.1l5.8,1.9c1.5.5,2.2,1.2,2.2,2.2s-1.4,2.2-3.6,2.2-5-1.7-5.6-3.9l-5.2,1.6c.9,3.7,4.2,7.1,10.5,7.1h-.1Z"/>
    </g>
    <g fill="#9ca3af">
      <path d="M122,71.7l2.9-.9c.5,2.3,2.5,4,5.5,4s4.3-1.5,4.3-3-.8-2-2.8-2.7l-4.7-1.5c-2.5-.8-4.3-2.3-4.3-4.7s2.8-5.4,7-5.4,6.7,2.1,7.5,4.8l-2.8.8c-.6-1.8-2.4-3-4.8-3s-3.8,1.2-3.8,2.6.7,1.7,2.5,2.3l4.4,1.4c2.9,1,4.9,2.2,4.9,5.1s-3,5.9-7.5,5.9-7.5-2.8-8.2-5.8h0Z"/>
      <path d="M141.5,72.7v-6.7h-2.5v-2.6h2.5v-4.6h2.9v4.6h4.4v2.6h-4.4v6.7c0,1.3.6,2.1,2,2.1s1.2-.1,1.8-.4l.7,2.4c-1,.4-2,.7-3.1.7-3,0-4.3-1.9-4.3-4.7h0Z"/>
      <path d="M151.7,63.4h2.9v2.2c.8-1.7,2.4-2.7,4.7-2.4v2.7c-3-.4-4.7,1-4.7,5.1v6.2h-2.9v-13.8Z"/>
      <path d="M160.2,70.3c0-4.2,3-7.3,6.9-7.3s3.9.9,4.9,2.4v-2h2.9v13.8h-2.9v-2.1c-1,1.5-2.7,2.4-4.9,2.4-3.9,0-6.9-3.1-6.9-7.3h0ZM172.1,70.3c0-2.7-2-4.6-4.5-4.6s-4.5,1.9-4.5,4.6,1.9,4.7,4.5,4.7,4.5-2,4.5-4.7Z"/>
      <path d="M179.8,72.7v-6.7h-2.5v-2.6h2.5v-4.6h2.9v4.6h4.4v2.6h-4.4v6.7c0,1.3.6,2.1,2,2.1s1.2-.1,1.8-.4l.7,2.4c-1,.4-2,.7-3.1.7-3,0-4.3-1.9-4.3-4.7h0Z"/>
      <path d="M188.6,70.3c0-4.1,2.9-7.3,7.1-7.3s7,3.1,7,7,0,.7,0,1.1h-11.2c.2,2.3,1.8,3.9,4.6,3.9s3.3-1,3.9-2.2l2.7.8c-.9,1.9-3,3.9-6.6,3.9s-7.4-2.9-7.4-7.3h-.1ZM195.7,65.6c-2.4,0-4.1,1.7-4.3,3.7h8.4c-.2-2.1-1.7-3.7-4.2-3.7h.1Z"/>
      <path d="M205.9,79.7l2.7-1c.8,1.4,2,2.1,4,2.1s4.1-1.8,4.1-4.2v-2c-1.1,1.5-2.8,2.3-4.9,2.3-4,0-6.9-3.1-6.9-7s2.9-7,6.9-7,3.8.9,4.9,2.3v-2h2.9v13.3c0,3.8-2.8,6.6-7.1,6.6s-5.4-1.5-6.6-3.6v.2ZM216.7,70c0-2.5-1.9-4.4-4.5-4.4s-4.5,1.8-4.5,4.4,1.8,4.4,4.5,4.4,4.5-1.8,4.5-4.4Z"/>
      <path d="M223,59.4c0-1,.8-1.8,1.8-1.8s1.8.8,1.8,1.8-.8,1.8-1.8,1.8-1.8-.8-1.8-1.8ZM223.3,63.4h2.9v13.8h-2.9v-13.8Z"/>
      <path d="M229.2,70.3c0-4.1,3.1-7.3,7.3-7.3s6,2.4,6.6,4.4l-2.7.8c-.4-1.3-1.8-2.6-3.9-2.6s-4.4,2.1-4.4,4.6,1.7,4.7,4.4,4.7,3.5-1.2,3.9-2.5l2.7.8c-.5,2-2.9,4.3-6.5,4.3s-7.3-3.2-7.3-7.3h-.1Z"/>
      <path d="M252.9,63.4h2.9v2c.9-1.3,2.3-2.3,4.3-2.3s3.5.9,4.3,2.4c.9-1.3,2.5-2.4,4.8-2.4s5.4,2.1,5.4,5.9v8.3h-2.9v-7.7c0-2.3-1-3.8-3.1-3.8s-3.4,1.6-3.4,4.3v7.2h-2.9v-7.7c0-2.3-.9-3.8-3-3.8s-3.5,1.7-3.5,4.5v7h-2.9v-13.8h0Z"/>
      <path d="M277.5,70.3c0-4.2,3-7.3,6.9-7.3s3.9.9,4.9,2.4v-2h2.9v13.8h-2.9v-2.1c-1,1.5-2.7,2.4-4.9,2.4-3.9,0-6.9-3.1-6.9-7.3h0ZM289.4,70.3c0-2.7-2-4.6-4.5-4.6s-4.5,1.9-4.5,4.6,1.9,4.7,4.5,4.7,4.5-2,4.5-4.7Z"/>
      <path d="M296.1,63.4h2.9v2.2c.8-1.7,2.4-2.7,4.7-2.4v2.7c-3-.4-4.7,1-4.7,5.1v6.2h-2.9v-13.8Z"/>
      <path d="M306.3,57.1h2.9v12.5l5.7-6.2h3.5l-5.5,6,6.2,7.9h-3.4l-4.6-5.8-1.8,2v3.8h-2.9v-20.1h-.1Z"/>
      <path d="M319.5,70.3c0-4.1,2.9-7.3,7.1-7.3s7,3.1,7,7,0,.7,0,1.1h-11.2c.2,2.3,1.8,3.9,4.6,3.9s3.3-1,3.9-2.2l2.7.8c-.9,1.9-3,3.9-6.6,3.9s-7.4-2.9-7.4-7.3h-.1ZM326.7,65.6c-2.4,0-4.1,1.7-4.3,3.7h8.4c-.2-2.1-1.7-3.7-4.2-3.7h.1Z"/>
      <path d="M337.3,72.7v-6.7h-2.5v-2.6h2.5v-4.6h2.9v4.6h4.4v2.6h-4.4v6.7c0,1.3.6,2.1,2,2.1s1.2-.1,1.8-.4l.7,2.4c-1,.4-2,.7-3.1.7-3,0-4.3-1.9-4.3-4.7h0Z"/>
      <path d="M347.2,59.4c0-1,.8-1.8,1.8-1.8s1.8.8,1.8,1.8-.8,1.8-1.8,1.8-1.8-.8-1.8-1.8ZM347.6,63.4h2.9v13.8h-2.9v-13.8Z"/>
      <path d="M354.3,63.4h2.9v2.1c.9-1.4,2.5-2.5,4.8-2.5,3.5,0,5.5,2.3,5.5,6.1v8.1h-2.9v-7.6c0-2.4-1.2-3.9-3.4-3.9s-3.9,1.8-3.9,4.6v6.9h-2.9v-13.8h-.1Z"/>
      <path d="M371.3,79.7l2.7-1c.8,1.4,2,2.1,4,2.1s4.1-1.8,4.1-4.2v-2c-1.1,1.5-2.8,2.3-4.9,2.3-4,0-6.9-3.1-6.9-7s2.9-7,6.9-7,3.8.9,4.9,2.3v-2h2.9v13.3c0,3.8-2.8,6.6-7.1,6.6s-5.4-1.5-6.6-3.6v.2ZM382.1,70c0-2.5-1.9-4.4-4.5-4.4s-4.5,1.8-4.5,4.4,1.8,4.4,4.5,4.4,4.5-1.8,4.5-4.4Z"/>
      <path d="M394.8,70.3c0-4.2,3-7.3,6.9-7.3s3.9.9,4.9,2.4v-8.3h2.9v20.1h-2.9v-2.1c-1,1.5-2.7,2.4-4.9,2.4-3.9,0-6.9-3.1-6.9-7.3h0ZM406.7,70.3c0-2.7-2-4.6-4.5-4.6s-4.5,1.9-4.5,4.6,1.9,4.7,4.5,4.7,4.5-2,4.5-4.7Z"/>
      <path d="M412.5,70.3c0-4.1,2.9-7.3,7.1-7.3s7,3.1,7,7,0,.7,0,1.1h-11.2c.2,2.3,1.8,3.9,4.6,3.9s3.3-1,3.9-2.2l2.7.8c-.9,1.9-3,3.9-6.6,3.9s-7.4-2.9-7.4-7.3h0ZM419.7,65.6c-2.4,0-4.1,1.7-4.3,3.7h8.4c-.2-2.1-1.7-3.7-4.2-3.7h.1Z"/>
      <path d="M428.5,73.4l2.6-.8c.3,1.5,1.9,2.6,3.8,2.6s2.9-.9,2.9-1.8-.6-1.3-1.8-1.7l-3.5-1c-1.8-.6-3.3-1.6-3.3-3.5s2.4-4.1,5.5-4.1,5.1,1.5,5.8,3.5l-2.5.7c-.3-1-1.7-1.9-3.3-1.9s-2.6.8-2.6,1.6.5,1,1.5,1.3l3.4,1c2,.6,3.7,1.5,3.7,3.8s-2.4,4.4-5.8,4.4-5.8-2-6.3-4.2h-.1Z"/>
      <path d="M443.4,59.4c0-1,.8-1.8,1.8-1.8s1.8.8,1.8,1.8-.8,1.8-1.8,1.8-1.8-.8-1.8-1.8ZM443.7,63.4h2.9v13.8h-2.9v-13.8Z"/>
      <path d="M450.6,79.7l2.7-1c.8,1.4,2,2.1,4,2.1s4.1-1.8,4.1-4.2v-2c-1.1,1.5-2.8,2.3-4.9,2.3-4,0-6.9-3.1-6.9-7s2.9-7,6.9-7,3.8.9,4.9,2.3v-2h2.9v13.3c0,3.8-2.8,6.6-7.1,6.6s-5.4-1.5-6.6-3.6v.2ZM461.4,70c0-2.5-1.9-4.4-4.5-4.4s-4.5,1.8-4.5,4.4,1.8,4.4,4.5,4.4,4.5-1.8,4.5-4.4Z"/>
      <path d="M468.1,63.4h2.9v2.1c.9-1.4,2.5-2.5,4.8-2.5,3.5,0,5.5,2.3,5.5,6.1v8.1h-2.9v-7.6c0-2.4-1.2-3.9-3.4-3.9s-3.9,1.8-3.9,4.6v6.9h-2.9v-13.8h0Z"/>
      <path d="M484.1,70.3c0-4.1,2.9-7.3,7.1-7.3s7,3.1,7,7,0,.7,0,1.1h-11.2c.2,2.3,1.8,3.9,4.6,3.9s3.3-1,3.9-2.2l2.7.8c-.9,1.9-3,3.9-6.6,3.9s-7.4-2.9-7.4-7.3h0ZM491.2,65.6c-2.4,0-4.1,1.7-4.3,3.7h8.4c-.2-2.1-1.7-3.7-4.2-3.7h0Z"/>
      <path d="M501.2,63.4h2.9v2.2c.8-1.7,2.4-2.7,4.7-2.4v2.7c-3-.4-4.7,1-4.7,5.1v6.2h-2.9v-13.8Z"/>
    </g>
  </svg>
)

const iconMap = { Palette, Layout, Smartphone, BarChart3, Shield, Zap, Megaphone, RefreshCw, PenTool }

const EditableText = ({ value, onChange, tag: Tag = 'span', className = '' }) => (
  <Tag
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) => onChange(e.target.innerText)}
    className={className}
  >
    {value}
  </Tag>
)

const LineItem = ({ phase, index, onUpdate, onDelete, onToggleOptional }) => {
  const lowTotal = phase.lowHrs * phase.rate
  const highTotal = phase.highHrs * phase.rate

  return (
    <tr className={`pricing-row group ${phase.optional ? 'opacity-60' : ''}`}>
      <td className="py-3 pr-6 align-top">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <EditableText
                value={phase.name}
                onChange={(val) => onUpdate(index, { ...phase, name: val })}
                tag="span"
                className="font-medium text-slate-900"
              />
              {phase.optional && (
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded print:bg-slate-100">Optional</span>
              )}
            </div>
            <EditableText
              value={phase.description}
              onChange={(val) => onUpdate(index, { ...phase, description: val })}
              tag="p"
              className="text-slate-500 text-sm mt-1"
            />
          </div>
          <div className="no-print flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleOptional(index)}
              className={`p-1 rounded text-xs ${phase.optional ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              title={phase.optional ? 'Mark as required' : 'Mark as optional'}
            >
              Opt
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
              title="Delete phase"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-center text-sm text-slate-600 align-top whitespace-nowrap">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate(index, { ...phase, lowHrs: parseFloat(e.target.innerText) || 0 })}
        >
          {phase.lowHrs}
        </span>
        –
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate(index, { ...phase, highHrs: parseFloat(e.target.innerText) || 0 })}
        >
          {phase.highHrs}
        </span>
      </td>
      <td className="py-3 pl-4 text-right text-sm text-slate-600 align-top whitespace-nowrap">
        ${lowTotal.toLocaleString()}–${highTotal.toLocaleString()}
      </td>
    </tr>
  )
}

// Dashboard Component
function Dashboard({ proposals, onCreate, onDelete }) {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <header className="flex justify-between items-center mb-8">
          <div>
            <Logo />
            <p className="text-slate-500 mt-2">Proposal Generator</p>
          </div>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        </header>

        {proposals.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No proposals yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map(p => (
              <Link
                key={p.id}
                to={`/${p.id}`}
                className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-slate-900">{p.projectName}</h3>
                    <p className="text-sm text-slate-500">{p.clientName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded ${p.status === 'sent' ? 'bg-blue-100 text-blue-700' : p.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                    <span className="text-sm text-slate-400">{p.date}</span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id); }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 text-slate-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Editor Component
function Editor({ proposal, onSave, templates }) {
  const [data, setData] = useState(proposal)

  // Get benefits and upsells from template based on projectType
  const template = templates[data.projectType] || templates['web'] || {}
  const benefits = template.benefits || data.benefits || []
  const upsells = template.upsells || data.upsells || []
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-save on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (data !== proposal) {
        setSaving(true)
        onSave(data).then(() => setSaving(false))
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [data])

  const updateField = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updatePhase = useCallback((index, updatedPhase) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === index ? updatedPhase : p)
    }))
  }, [])

  const addPhase = useCallback(() => {
    setData(prev => ({
      ...prev,
      phases: [...prev.phases, { name: 'New Phase', description: 'Description of this phase.', lowHrs: 10, highHrs: 15, rate: 120, optional: false }]
    }))
  }, [])

  const deletePhase = useCallback((index) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index)
    }))
  }, [])

  const toggleOptional = useCallback((index) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === index ? { ...p, optional: !p.optional } : p)
    }))
  }, [])

  const handleCopyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const requiredPhases = data.phases.filter(p => !p.optional)
  const optionalPhases = data.phases.filter(p => p.optional)

  const subtotal = requiredPhases.reduce(
    (acc, phase) => ({
      lowHrs: acc.lowHrs + phase.lowHrs,
      highHrs: acc.highHrs + phase.highHrs,
      lowTotal: acc.lowTotal + (phase.lowHrs * phase.rate),
      highTotal: acc.highTotal + (phase.highHrs * phase.rate)
    }),
    { lowHrs: 0, highHrs: 0, lowTotal: 0, highTotal: 0 }
  )

  const discount = data.discountPercent || 0
  const totals = {
    ...subtotal,
    lowTotal: subtotal.lowTotal * (1 - discount / 100),
    highTotal: subtotal.highTotal * (1 - discount / 100)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 print:bg-white print:py-0">
      {/* Toolbar */}
      <div className="no-print fixed top-4 left-4 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>
      <div className="no-print fixed top-4 right-4 flex items-center gap-2 z-50">
        {saving && <span className="text-xs text-slate-400">Saving...</span>}
        <button
          onClick={handleCopyJSON}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'JSON'}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded text-sm hover:bg-slate-800"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Internal Notes (no-print) */}
      <div className="no-print max-w-[8.5in] mx-auto mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-700 uppercase">Internal Notes</span>
            {discount > 0 && (
              <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                <Percent className="w-3 h-3" /> {discount}% discount
              </span>
            )}
          </div>
          {data.archivePath && (
            <span className="text-xs text-amber-600 font-mono">
              Save PDF to: {data.archivePath}/proposal.pdf
            </span>
          )}
        </div>
        <textarea
          value={data.internalNotes || ''}
          onChange={(e) => updateField('internalNotes', e.target.value)}
          placeholder="Add internal notes here (won't print)..."
          className="w-full mt-2 text-sm text-amber-900 bg-transparent border-none resize-none focus:outline-none"
          rows={2}
        />
      </div>

      {/* Document */}
      <div className="print-page mx-auto bg-white shadow-sm p-[0.6in] print:shadow-none">
        {/* Header */}
        <header className="flex justify-between items-start mb-12">
          <Logo />
          <div className="text-right text-sm text-slate-500">
            <p>{data.contactInfo.email}</p>
            <p>{data.contactInfo.phone}</p>
          </div>
        </header>

        {/* Title Block */}
        <div className="mb-10">
          <p className="text-sm text-slate-400 mb-1">Proposal for</p>
          <h2 className="text-xl text-slate-900 mb-5">
            <EditableText
              value={data.clientName}
              onChange={(val) => updateField('clientName', val)}
              tag="span"
              className=""
            />
            {data.clientCompany && (
              <>
                <span className="text-slate-400">, </span>
                <EditableText
                  value={data.clientCompany}
                  onChange={(val) => updateField('clientCompany', val)}
                  tag="span"
                  className=""
                />
              </>
            )}
          </h2>

          <EditableText
            value={data.projectName}
            onChange={(val) => updateField('projectName', val)}
            tag="h1"
            className="text-3xl font-semibold text-slate-900 tracking-tight"
          />
          <div className="flex gap-4 mt-2 text-sm text-slate-400">
            <EditableText
              value={data.date}
              onChange={(val) => updateField('date', val)}
              tag="span"
            />
            {data.expirationDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Valid until {data.expirationDate}
              </span>
            )}
          </div>
        </div>

        {/* Overview */}
        <div className="mb-12">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Overview</h3>
          <EditableText
            value={data.projectDescription}
            onChange={(val) => updateField('projectDescription', val)}
            tag="p"
            className="text-slate-600 leading-relaxed"
          />
        </div>

        {/* Benefits Grid */}
        <div className="mb-12">
          <h3 className="text-sm font-medium text-slate-400 mb-4">What's Included</h3>
          <div className="benefits-grid grid grid-cols-3 gap-6">
            {benefits.map((benefit, i) => {
              const Icon = iconMap[benefit.icon]
              return (
                <div key={i} className="flex gap-3">
                  {Icon && <Icon className="w-5 h-5 text-[#d72027] shrink-0 mt-0.5" strokeWidth={1.5} />}
                  <div>
                    <div className="font-medium text-slate-900">{benefit.title}</div>
                    <div className="text-slate-500 text-sm">{benefit.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Estimate - Page 2 */}
        <div className="mb-12 break-before-page pt-12">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Estimate</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-sm font-medium text-slate-400">Phase</th>
                <th className="text-center py-2 text-sm font-medium text-slate-400 w-24">Hours</th>
                <th className="text-right py-2 text-sm font-medium text-slate-400 w-44">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.phases.map((phase, i) => (
                <LineItem key={i} phase={phase} index={i} onUpdate={updatePhase} onDelete={deletePhase} onToggleOptional={toggleOptional} />
              ))}
            </tbody>
          </table>

          {/* Totals Section - stays together */}
          <div className="estimate-totals border-t border-slate-300 mt-0">
            <table className="w-full">
              <tbody>
                {discount > 0 && (
                  <tr>
                    <td className="py-2 text-sm text-slate-500">Subtotal</td>
                    <td className="w-24"></td>
                    <td className="py-2 text-right text-sm text-slate-500 whitespace-nowrap w-44">
                      ${subtotal.lowTotal.toLocaleString()}–${subtotal.highTotal.toLocaleString()}
                    </td>
                  </tr>
                )}
                {discount > 0 && (
                  <tr>
                    <td className="py-2 text-sm text-green-600">Discount ({discount}%)</td>
                    <td></td>
                    <td className="py-2 text-right text-sm text-green-600 whitespace-nowrap">
                      -${(subtotal.lowTotal * discount / 100).toLocaleString()}–${(subtotal.highTotal * discount / 100).toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-4 font-medium text-slate-900">Total</td>
                  <td className="py-4 text-center text-sm text-slate-600">
                    {totals.lowHrs}–{totals.highHrs} hrs
                  </td>
                  <td className="py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                    ${totals.lowTotal.toLocaleString()}–${totals.highTotal.toLocaleString()}
                  </td>
                </tr>
                {optionalPhases.length > 0 && (
                  <tr>
                    <td className="pb-2 text-sm text-slate-500">With optional phases</td>
                    <td></td>
                    <td className="pb-2 text-right text-sm text-slate-500 whitespace-nowrap">
                      ${(totals.lowTotal + optionalPhases.reduce((a, p) => a + p.lowHrs * p.rate, 0) * (1 - discount / 100)).toLocaleString()}–${(totals.highTotal + optionalPhases.reduce((a, p) => a + p.highHrs * p.rate, 0) * (1 - discount / 100)).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start mt-4">
            <div className="text-sm text-slate-400">
              <p>Rate: ${data.phases[0]?.rate}/hr</p>
            </div>
            <button
              onClick={addPhase}
              className="no-print flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <Plus className="w-4 h-4" /> Add phase
            </button>
          </div>
        </div>

        {/* Upsells */}
        <div className="mb-12 upsells-section">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Also Available</h3>
          <div className="grid grid-cols-3 gap-6">
            {upsells.map((upsell, i) => {
              const Icon = iconMap[upsell.icon]
              return (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  {Icon && <Icon className="w-5 h-5 text-[#d72027] mb-2" strokeWidth={1.5} />}
                  <div className="font-medium text-slate-900 mb-1">{upsell.title}</div>
                  <div className="text-slate-500 text-sm">{upsell.description}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-12 border-t border-slate-100 text-sm text-slate-400">
          {data.contactInfo.website}
        </footer>
      </div>

      {/* Instructions */}
      <p className="no-print text-center text-sm text-slate-400 mt-8">
        Click any text to edit · Auto-saves every second
      </p>
    </div>
  )
}

// Dashboard Page
function DashboardPage() {
  const [proposals, setProposals] = useState([])
  const [templates, setTemplates] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/proposals`).then(r => r.json()),
      fetch(`${API_BASE}/templates`).then(r => r.json())
    ])
      .then(([proposalsData, templatesData]) => {
        setProposals(proposalsData)
        const templatesMap = {}
        templatesData.forEach(t => { templatesMap[t.type] = t })
        setTemplates(templatesMap)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load data:', err)
        setLoading(false)
      })
  }, [])

  const createProposal = async () => {
    const newProposal = {
      clientName: 'New Client',
      clientCompany: '',
      projectName: 'New Project',
      projectType: 'web',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      expirationDate: '',
      projectDescription: 'Project description goes here.',
      internalNotes: '',
      phases: [
        { name: 'Discovery & Planning', description: 'Initial research and project scoping.', lowHrs: 8, highHrs: 12, rate: 120, optional: false },
        { name: 'Design & Development', description: 'Building the core functionality.', lowHrs: 40, highHrs: 60, rate: 120, optional: false }
      ],
      discountPercent: 0,
      monthlyFee: 39,
      paymentTerms: { depositPercent: 50, schedule: '' },
      contactInfo: {
        name: 'Adrial Dale',
        phone: '(919) 968-8818',
        email: 'adrial@adrialdesigns.com',
        website: 'www.adrialdesigns.com'
      }
    }

    const res = await fetch(`${API_BASE}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProposal)
    })
    const saved = await res.json()
    navigate(`/${saved.id}`)
  }

  const deleteProposal = async (id) => {
    if (confirm('Delete this proposal?')) {
      await fetch(`${API_BASE}/proposals/${id}`, { method: 'DELETE' })
      setProposals(proposals.filter(p => p.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return <Dashboard proposals={proposals} onCreate={createProposal} onDelete={deleteProposal} />
}

// Editor Page (loads proposal from URL)
function EditorPage() {
  const { id } = useParams()
  const [proposal, setProposal] = useState(null)
  const [templates, setTemplates] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/proposals/${id}`).then(r => r.json()),
      fetch(`${API_BASE}/templates`).then(r => r.json())
    ])
      .then(([proposalData, templatesData]) => {
        setProposal(proposalData)
        const templatesMap = {}
        templatesData.forEach(t => { templatesMap[t.type] = t })
        setTemplates(templatesMap)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load proposal:', err)
        setLoading(false)
      })
  }, [id])

  const saveProposal = async (updatedProposal) => {
    await fetch(`${API_BASE}/proposals/${updatedProposal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProposal)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Proposal not found</p>
      </div>
    )
  }

  return <Editor proposal={proposal} onSave={saveProposal} templates={templates} />
}

// Main App with Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
