'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, FileText, Users, Calendar, Settings, AlertCircle, Upload, Clock, CheckCircle, MessageCircle, Send, X, Download, Paperclip, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useDropzone } from 'react-dropzone'
import { Progress } from "@/components/ui/progress"

export default function App() {
  const [cases, setCases] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(false)
  const [documents, setDocuments] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})
  const [ocrProgress, setOcrProgress] = useState({})
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [additionalFiles, setAdditionalFiles] = useState([])
  const [showAdditionalFiles, setShowAdditionalFiles] = useState(false)
  const [showAddFileDialog, setShowAddFileDialog] = useState(false)
  const [showEditCaseDialog, setShowEditCaseDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showArchivedCases, setShowArchivedCases] = useState(false)
  const [archivedCases, setArchivedCases] = useState([])

  // Load cases on component mount
  useEffect(() => {
    loadCases()
  }, [])

  // Load archived cases when archive panel is opened
  useEffect(() => {
    if (showArchivedCases) {
      loadArchivedCases()
    }
  }, [showArchivedCases])

  const loadCases = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/optimized/cases')
      if (response.ok) {
        const data = await response.json()
        setCases(data)
      } else {
        toast.error('Ошибка загрузки дел')
      }
    } catch (error) {
      console.error('Error loading cases:', error)
      toast.error('Ошибка соединения с сервером')
    } finally {
      setIsLoading(false)
    }
  }

  const loadArchivedCases = async () => {
    try {
      const response = await fetch('/api/optimized/cases/archived')
      if (response.ok) {
        const data = await response.json()
        setArchivedCases(data)
      } else {
        toast.error('Ошибка загрузки архива')
      }
    } catch (error) {
      console.error('Error loading archived cases:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const restoreCase = async (caseId) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}/restore`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const restoredCase = await response.json()
        setCases([...cases, restoredCase.case])
        setArchivedCases(archivedCases.filter(c => c.id !== caseId))
        toast.success('Дело восстановлено из архива')
      } else {
        toast.error('Ошибка восстановления дела')
      }
    } catch (error) {
      console.error('Error restoring case:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const createCase = async (caseData) => {
    try {
      const response = await fetch('/api/optimized/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData)
      })
      
      if (response.ok) {
        const newCase = await response.json()
        setCases([...cases, newCase])
        setShowNewCaseDialog(false)
        toast.success('Дело создано успешно')
        return newCase
      } else {
        toast.error('Ошибка создания дела')
      }
    } catch (error) {
      console.error('Error creating case:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const updateCase = async (caseId, caseData) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData)
      })
      
      if (response.ok) {
        const updatedCase = await response.json()
        setCases(cases.map(c => c.id === caseId ? updatedCase : c))
        if (selectedCase?.id === caseId) {
          setSelectedCase(updatedCase)
        }
        setShowEditCaseDialog(false)
        toast.success('Дело обновлено успешно')
        return updatedCase
      } else {
        toast.error('Ошибка обновления дела')
      }
    } catch (error) {
      console.error('Error updating case:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const archiveCase = async (caseId) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}/archive`, {
        method: 'POST'
      })
      
      if (response.ok) {
        setCases(cases.filter(c => c.id !== caseId))
        if (selectedCase?.id === caseId) {
          setSelectedCase(null)
        }
        setShowArchiveDialog(false)
        toast.success('Дело отправлено в архив')
      } else {
        toast.error('Ошибка архивирования дела')
      }
    } catch (error) {
      console.error('Error archiving case:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const deleteCase = async (caseId) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setCases(cases.filter(c => c.id !== caseId))
        if (selectedCase?.id === caseId) {
          setSelectedCase(null)
        }
        setShowDeleteDialog(false)
        toast.success('Дело удалено навсегда')
      } else {
        toast.error('Ошибка удаления дела')
      }
    } catch (error) {
      console.error('Error deleting case:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  // Document upload with OCR
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    onDrop: async (acceptedFiles) => {
      if (!selectedCase) {
        toast.error('Выберите дело для загрузки документов')
        return
      }
      
      for (const file of acceptedFiles) {
        await uploadDocument(file)
      }
    }
  })

  const uploadDocument = async (file) => {
    const fileId = Date.now() + '-' + file.name
    
    // Initialize progress
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
    setOcrProgress(prev => ({ ...prev, [fileId]: { status: 'pending', progress: 0 } }))
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('caseId', selectedCase.id)
      
      // Upload with progress
      const response = await fetch('/api/optimized/photos/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const uploadResult = await response.json()
        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
        
        // Start OCR processing
        setOcrProgress(prev => ({ 
          ...prev, 
          [fileId]: { status: 'processing', progress: 0 } 
        }))
        
        // Poll OCR status
        pollOcrStatus(uploadResult.documentId, fileId)
        
        toast.success(`Файл ${file.name} загружен. Начинается обработка OCR...`)
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(`Ошибка загрузки ${file.name}`)
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
      setOcrProgress(prev => ({ ...prev, [fileId]: { status: 'failed', progress: 0 } }))
    }
  }

  const pollOcrStatus = async (documentId, fileId) => {
    try {
      const response = await fetch(`/api/optimized/photos/${documentId}/ocr-status`)
      
      if (response.ok) {
        const status = await response.json()
        
        setOcrProgress(prev => ({ 
          ...prev, 
          [fileId]: { 
            status: status.status, 
            progress: status.progress || 0,
            extractedText: status.extractedText
          } 
        }))
        
        if (status.status === 'completed') {
          toast.success('OCR обработка завершена успешно')
          loadDocuments(selectedCase.id) // Refresh documents
        } else if (status.status === 'failed') {
          toast.error('Ошибка OCR обработки')
        } else {
          // Continue polling
          setTimeout(() => pollOcrStatus(documentId, fileId), 2000)
        }
      }
    } catch (error) {
      console.error('OCR polling error:', error)
      setOcrProgress(prev => ({ 
        ...prev, 
        [fileId]: { status: 'failed', progress: 0 } 
      }))
    }
  }

  const loadDocuments = async (caseId) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}`)
      if (response.ok) {
        const caseData = await response.json()
        setDocuments(caseData.photos || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  // AI Chat functions
  const loadChatHistory = async (caseId) => {
    try {
      setIsChatLoading(true)
      const response = await fetch(`/api/optimized/cases/${caseId}/chat`)
      if (response.ok) {
        const messages = await response.json()
        setChatMessages(messages)
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setIsChatLoading(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedCase) return

    setIsChatLoading(true)
    const userMessage = chatInput.trim()
    setChatInput('')

    // Add user message to UI immediately
    const newUserMessage = {
      id: Date.now(),
      message_type: 'user',
      message_text: userMessage,
      created_at: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, newUserMessage])

    try {
      const response = await fetch(`/api/optimized/cases/${selectedCase.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage = {
          id: Date.now() + 1,
          message_type: 'ai',
          message_text: data.response,
          created_at: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, aiMessage])
      } else {
        toast.error('Ошибка отправки сообщения')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Ошибка соединения с ИИ')
    } finally {
      setIsChatLoading(false)
    }
  }

  // Photo modal functions
  const openPhotoModal = (photo, index) => {
    setSelectedPhoto(photo)
    setPhotoIndex(index)
    setShowPhotoModal(true)
  }

  const nextPhoto = () => {
    if (documents.length > 0) {
      const nextIndex = (photoIndex + 1) % documents.length
      setPhotoIndex(nextIndex)
      setSelectedPhoto(documents[nextIndex])
    }
  }

  const prevPhoto = () => {
    if (documents.length > 0) {
      const prevIndex = photoIndex === 0 ? documents.length - 1 : photoIndex - 1
      setPhotoIndex(prevIndex)
      setSelectedPhoto(documents[prevIndex])
    }
  }

  // Download PDF with all OCR transcriptions
  const downloadPDF = async () => {
    if (!selectedCase) return

    try {
      const response = await fetch(`/api/optimized/cases/${selectedCase.id}/pdf`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `case_${selectedCase.case_number}_transcriptions.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('PDF скачан успешно')
      } else {
        toast.error('Ошибка создания PDF')
      }
    } catch (error) {
      console.error('PDF download error:', error)
      toast.error('Ошибка скачивания PDF')
    }
  }

  // Load additional files for a case
  const loadAdditionalFiles = async (caseId) => {
    try {
      const response = await fetch(`/api/optimized/cases/${caseId}/additional-files`)
      if (response.ok) {
        const files = await response.json()
        setAdditionalFiles(files)
      }
    } catch (error) {
      console.error('Error loading additional files:', error)
    }
  }

  // Upload additional file
  const uploadAdditionalFile = async (file, description, isImportant) => {
    if (!selectedCase) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('caseId', selectedCase.id)
      formData.append('description', description)
      formData.append('isImportant', isImportant)

      const response = await fetch('/api/optimized/additional-files/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast.success('Файл загружен успешно')
        loadAdditionalFiles(selectedCase.id)
        setShowAddFileDialog(false)
      } else {
        toast.error('Ошибка загрузки файла')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  // Delete additional file
  const deleteAdditionalFile = async (fileId) => {
    try {
      const response = await fetch(`/api/optimized/additional-files/${fileId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Файл удален')
        loadAdditionalFiles(selectedCase.id)
      } else {
        toast.error('Ошибка удаления файла')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  // Download additional file
  const downloadAdditionalFile = async (file) => {
    try {
      // Create a temporary download link
      const blob = new Blob(['Файл: ' + file.original_name + '\nОписание: ' + (file.description || 'Нет описания')], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Файл скачан')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Ошибка скачивания файла')
    }
  }

  // Load documents, chat and additional files when case is selected
  useEffect(() => {
    if (selectedCase) {
      // Clear chat when switching cases
      setChatMessages([])
      setChatInput('')
      setIsChatLoading(false)
      
      // Load new case data
      loadDocuments(selectedCase.id)
      loadChatHistory(selectedCase.id)
      loadAdditionalFiles(selectedCase.id)
    } else {
      // Clear everything when no case selected
      setChatMessages([])
      setChatInput('')
      setIsChatLoading(false)
      setDocuments([])
      setAdditionalFiles([])
    }
  }, [selectedCase])

  const filteredCases = cases.filter(case_ => 
    case_.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const StatusBadge = ({ status }) => {
    const variants = {
      active: 'default',
      paused: 'secondary', 
      completed: 'outline',
      archived: 'destructive'
    }
    const labels = {
      active: 'Активное',
      paused: 'Приостановлено',
      completed: 'Завершено', 
      archived: 'Архив'
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const PriorityBadge = ({ priority }) => {
    const variants = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive'
    }
    const labels = {
      low: 'Низкий',
      medium: 'Средний', 
      high: 'Высокий',
      urgent: 'Срочно'
    }
    return <Badge variant={variants[priority]}>{labels[priority]}</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Адвокатская Практика</h1>
            </div>
                   <div className="flex items-center space-x-2">
                     {selectedCase && (
                       <>
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => setShowAdditionalFiles(!showAdditionalFiles)}
                           className="flex items-center space-x-1"
                         >
                           <Paperclip className="h-4 w-4" />
                           <span className="hidden sm:inline">Файлы</span>
                         </Button>
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={downloadPDF}
                           className="flex items-center space-x-1"
                         >
                           <Download className="h-4 w-4" />
                           <span className="hidden sm:inline">PDF</span>
                         </Button>
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => setShowChat(!showChat)}
                           className="flex items-center space-x-1"
                         >
                           <MessageCircle className="h-4 w-4" />
                           <span className="hidden sm:inline">ИИ-чат</span>
                         </Button>
                       </>
                     )}
                     <Button 
                       variant="outline" 
                       size="sm"
                       onClick={() => setShowArchivedCases(!showArchivedCases)}
                       className="flex items-center space-x-1"
                     >
                       <FileText className="h-4 w-4" />
                       <span className="hidden sm:inline">Архив</span>
                     </Button>
                     <Button variant="outline" size="sm" className="flex items-center space-x-1">
                       <Settings className="h-4 w-4" />
                       <span className="hidden sm:inline">Настройки</span>
                     </Button>
                   </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-4">
          {/* Left Sidebar - Cases List */}
          <div className="lg:col-span-1">
            {/* Archive Panel */}
            {showArchivedCases && (
              <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 mb-4">
                <div className="p-4 border-b border-yellow-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-yellow-800">Архив дел</h3>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowArchivedCases(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-yellow-600">Архивированные дела</p>
                </div>
                
                <div className="max-h-96 overflow-y-auto p-4">
                  {archivedCases.length === 0 ? (
                    <div className="text-center text-yellow-600 py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
                      <p>Архив пуст</p>
                      <p className="text-sm">Нет архивированных дел</p>
                    </div>
                  ) : (
                    archivedCases.map((case_) => (
                      <div 
                        key={case_.id}
                        className="p-3 border border-yellow-200 rounded-lg mb-2 hover:bg-yellow-100 transition-colors bg-white"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm text-gray-900">{case_.title}</h4>
                          <Badge variant="outline" className="text-xs">Архив</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{case_.client_name}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            {new Date(case_.created_at).toLocaleDateString('ru-RU')}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => restoreCase(case_.id)}
                            className="text-xs"
                          >
                            Восстановить
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Дела</h2>
                  <Dialog open={showNewCaseDialog} onOpenChange={setShowNewCaseDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Новое дело
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Создать новое дело</DialogTitle>
                        <DialogDescription>
                          Заполните основную информацию о деле
                        </DialogDescription>
                      </DialogHeader>
                      <NewCaseForm onSubmit={createCase} />
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Поиск дел..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredCases.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {cases.length === 0 ? 'Дел не найдено' : 'Ничего не найдено по запросу'}
                  </div>
                ) : (
                  filteredCases.map((case_) => (
                    <div 
                      key={case_.id}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedCase?.id === case_.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                      onClick={() => setSelectedCase(case_)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm">{case_.title}</h3>
                        <StatusBadge status={case_.status} />
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{case_.client_name}</p>
                      <div className="flex justify-between items-center">
                        <PriorityBadge priority={case_.priority} />
                        <span className="text-xs text-gray-500">
                          {new Date(case_.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedCase ? (
              <div className="space-y-6">
                {/* Case Info Header */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCase.title}</h2>
                      <p className="text-gray-600">{selectedCase.client_name}</p>
                    </div>
                    <div className="flex space-x-2">
                      <StatusBadge status={selectedCase.status} />
                      <PriorityBadge priority={selectedCase.priority} />
                    </div>
                  </div>
                   <p className="text-sm text-gray-900 mb-4">{selectedCase.description}</p>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={downloadPDF}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>Скачать PDF</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowEditCaseDialog(true)}
                      className="flex items-center space-x-1"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Редактировать</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowArchiveDialog(true)}
                      className="flex items-center space-x-1"
                    >
                      <FileText className="h-4 w-4" />
                      <span>В архив</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="flex items-center space-x-1"
                    >
                      <X className="h-4 w-4" />
                      <span>Удалить</span>
                    </Button>
                  </div>
                </div>

                {/* Photos Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Документы и фотографии</h3>
                    <div {...getRootProps()} className="cursor-pointer">
                      <input {...getInputProps()} />
                      <Button size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Загрузить файлы
                      </Button>
                    </div>
                  </div>
                  
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Нет загруженных документов</p>
                      <p className="text-sm">Перетащите файлы сюда или нажмите "Загрузить файлы"</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {documents.map((doc, index) => (
                        <div 
                          key={doc.id} 
                          className="relative bg-gray-50 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => openPhotoModal(doc, index)}
                        >
                          <div className="text-center">
                             {/* Photo thumbnail or icon */}
                             <div className="w-full h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden border border-blue-200">
                               <img 
                                 src={`/api/optimized/photos/${doc.id}/view`} 
                                 alt={doc.original_name}
                                 className="w-full h-full object-cover rounded-lg"
                                 onError={(e) => {
                                   e.target.style.display = 'none';
                                   const fallback = document.createElement('div');
                                   fallback.className = 'w-full h-full flex items-center justify-center';
                                   fallback.innerHTML = doc.file_type && doc.file_type.startsWith('image/') 
                                     ? '<svg class="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" /></svg>'
                                     : '<svg class="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" /></svg>';
                                   e.target.parentNode.appendChild(fallback);
                                 }}
                               />
                             </div>
                            <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <p className="text-xs font-medium truncate mb-1">{doc.original_name}</p>
                            <p className="text-xs text-gray-500">
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </p>
                            {doc.raw_text && (
                              <Badge variant="outline" className="text-xs mt-1">OCR готов</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Files Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Дополнительные файлы</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddFileDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Добавить файл
                    </Button>
                  </div>
                  
                  {additionalFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Нет дополнительных файлов</p>
                      <p className="text-sm">Нажмите "Добавить файл" для загрузки документов</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {additionalFiles.map((file) => (
                        <div key={file.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <p className="text-sm font-medium truncate">{file.original_name}</p>
                                  {file.is_important && (
                                    <Badge variant="destructive" className="text-xs">Важно</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {new Date(file.created_at).toLocaleDateString('ru-RU')} • 
                                  {(file.file_size / 1024).toFixed(1)} KB
                                </p>
                                {file.description && (
                                  <p className="text-xs text-gray-600 mt-1">{file.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => downloadAdditionalFile(file)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteAdditionalFile(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                 {/* AI Chat Section */}
                 <div className="bg-white rounded-lg shadow-sm border p-6">
                   <div className="flex items-center justify-between mb-4">
                     <div>
                       <h3 className="text-lg font-semibold">ИИ-ассистент</h3>
                       <p className="text-sm text-gray-500">Дело: {selectedCase.title}</p>
                     </div>
                     <Button 
                       variant={showChat ? "default" : "outline"}
                       size="sm"
                       onClick={() => setShowChat(!showChat)}
                     >
                       <MessageCircle className="h-4 w-4 mr-2" />
                       {showChat ? 'Скрыть чат' : 'Открыть чат'}
                     </Button>
                   </div>
                  
                  {showChat && (
                    <div className="border rounded-lg h-96 flex flex-col">
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isChatLoading && chatMessages.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p>Загрузка истории чата...</p>
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>Начните диалог с ИИ-ассистентом</p>
                            <p className="text-sm">Ассистент знает все о деле "{selectedCase.title}" и его документах</p>
                            <p className="text-xs text-gray-400 mt-2">
                              Загружено документов: {documents.length} | 
                              Доп. файлов: {additionalFiles.length}
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((message) => (
                            <div 
                              key={message.id}
                              className={`flex ${message.message_type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[80%] p-3 rounded-lg ${
                                message.message_type === 'user' 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-900'
                              }`}>
                                <p className="text-sm">{message.message_text}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {new Date(message.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                        {isChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 p-3 rounded-lg">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 border-t">
                        <div className="flex space-x-2">
                          <Input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Задайте вопрос о деле..."
                            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                          />
                          <Button 
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim() || isChatLoading}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Выберите дело</h3>
                <p className="text-gray-500">Выберите дело из списка слева для просмотра деталей</p>
              </div>
            )}
          </div>

        </div>
      </div>

              {/* Photo Modal */}
              <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
                <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">
                        {selectedPhoto?.original_name} ({photoIndex + 1} из {documents.length})
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadPDF}
                          className="flex items-center space-x-1"
                        >
                          <Download className="h-4 w-4" />
                          <span>Скачать PDF</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPhotoModal(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
            
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <div className="text-center mb-4">
                        <div className="w-full max-w-lg mx-auto mb-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 border-2 border-dashed border-blue-200">
                          <img 
                            src={`/api/optimized/photos/${selectedPhoto?.id}/view`} 
                            alt={selectedPhoto?.original_name}
                            className="w-full h-auto max-h-96 object-contain rounded-lg shadow-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.className = 'w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex flex-col items-center justify-center';
                              fallback.innerHTML = `
                                <div class="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-4">
                                  <svg class="h-8 w-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                  </svg>
                                </div>
                                <p class="text-sm text-gray-600 font-medium">${selectedPhoto?.original_name}</p>
                                <p class="text-xs text-gray-500 mt-1">Файл не может быть отображен</p>
                              `;
                              e.target.parentNode.appendChild(fallback);
                            }}
                          />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                          {selectedPhoto?.original_name}
                        </h3>
                        <div className="flex justify-center space-x-4 text-sm text-gray-500">
                          <span>📅 {selectedPhoto && new Date(selectedPhoto.created_at).toLocaleDateString('ru-RU')}</span>
                          <span>📦 {selectedPhoto && (selectedPhoto.file_size / 1024).toFixed(1)} KB</span>
                          <span>📄 {selectedPhoto?.file_type || 'Неизвестно'}</span>
                        </div>
                      </div>
              
                      {/* Navigation buttons */}
                      {documents.length > 1 && (
                        <div className="flex justify-between mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={prevPhoto}
                            className="flex items-center space-x-1"
                          >
                            ← Предыдущий
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={nextPhoto}
                            className="flex items-center space-x-1"
                          >
                            Следующий →
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* OCR Text Display */}
                    {selectedPhoto?.raw_text && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <FileText className="h-5 w-5 text-blue-600 mr-2" />
                          <h4 className="text-lg font-semibold text-gray-800">Распознанный текст</h4>
                        </div>
                        <div className="bg-white rounded-lg p-4 border">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {selectedPhoto.raw_text}
                          </p>
                        </div>
                        {selectedPhoto.confidence_score && (
                          <div className="mt-3 text-xs text-gray-500">
                            Уверенность OCR: {(selectedPhoto.confidence_score * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
        </DialogContent>
      </Dialog>

             {/* Add Additional File Dialog */}
             <Dialog open={showAddFileDialog} onOpenChange={setShowAddFileDialog}>
               <DialogContent className="max-w-md">
                 <DialogHeader>
                   <DialogTitle>Добавить файл</DialogTitle>
                   <DialogDescription>
                     Загрузите дополнительный файл к делу (Word, PDF, Excel и т.д.)
                   </DialogDescription>
                 </DialogHeader>
                 
                 <AddFileForm 
                   onSubmit={uploadAdditionalFile}
                   onCancel={() => setShowAddFileDialog(false)}
                 />
               </DialogContent>
             </Dialog>

             {/* Edit Case Dialog */}
             <Dialog open={showEditCaseDialog} onOpenChange={setShowEditCaseDialog}>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                   <DialogTitle>Редактировать дело</DialogTitle>
                   <DialogDescription>
                     Измените информацию о деле
                   </DialogDescription>
                 </DialogHeader>
                 <EditCaseForm 
                   case_={selectedCase}
                   onSubmit={(data) => updateCase(selectedCase.id, data)}
                   onCancel={() => setShowEditCaseDialog(false)}
                 />
               </DialogContent>
             </Dialog>

             {/* Archive Case Dialog */}
             <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                   <DialogTitle>Отправить в архив</DialogTitle>
                   <DialogDescription>
                     Дело будет перемещено в архив. Все документы, фотографии и чат сохранятся.
                   </DialogDescription>
                 </DialogHeader>
                 <div className="flex justify-end space-x-2">
                   <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
                     Отмена
                   </Button>
                   <Button onClick={() => archiveCase(selectedCase.id)}>
                     Отправить в архив
                   </Button>
                 </div>
               </DialogContent>
             </Dialog>

             {/* Delete Case Dialog */}
             <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                   <DialogTitle>Удалить дело навсегда</DialogTitle>
                   <DialogDescription>
                     ВНИМАНИЕ! Это действие нельзя отменить. Все документы, фотографии, чат и файлы будут удалены навсегда.
                   </DialogDescription>
                 </DialogHeader>
                 <div className="flex justify-end space-x-2">
                   <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                     Отмена
                   </Button>
                   <Button variant="destructive" onClick={() => deleteCase(selectedCase.id)}>
                     Удалить навсегда
                   </Button>
                 </div>
               </DialogContent>
             </Dialog>
           </div>
         )
       }

// Add File Form Component
function AddFileForm({ onSubmit, onCancel }) {
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [isImportant, setIsImportant] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (file) {
      onSubmit(file, description, isImportant)
      setFile(null)
      setDescription('')
      setIsImportant(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="file">Выберите файл</Label>
        <Input
          id="file"
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".doc,.docx,.pdf,.xls,.xlsx,.txt,.rtf"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Поддерживаются: Word, PDF, Excel, текстовые файлы
        </p>
      </div>

      <div>
        <Label htmlFor="description">Описание (необязательно)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Краткое описание файла..."
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isImportant"
          checked={isImportant}
          onChange={(e) => setIsImportant(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="isImportant" className="text-sm">
          Отметить как важный файл
        </Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={!file}>
          Загрузить
        </Button>
      </div>
    </form>
  )
}

// New Case Form Component
function NewCaseForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    description: '',
    priority: 'medium',
    case_type: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({
      title: '',
      client_name: '',
      description: '',
      priority: 'medium',
      case_type: ''
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Название дела</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          placeholder="Введите название дела"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="client_name">Клиент</Label>
        <Input
          id="client_name"
          value={formData.client_name}
          onChange={(e) => setFormData({...formData, client_name: e.target.value})}
          placeholder="Имя клиента"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="case_type">Тип дела</Label>
        <Input
          id="case_type"
          value={formData.case_type}
          onChange={(e) => setFormData({...formData, case_type: e.target.value})}
          placeholder="Гражданское, уголовное, административное..."
        />
      </div>
      
      <div>
        <Label htmlFor="priority">Приоритет</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Низкий</SelectItem>
            <SelectItem value="medium">Средний</SelectItem>
            <SelectItem value="high">Высокий</SelectItem>
            <SelectItem value="urgent">Срочный</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Краткое описание проблемы..."
          rows={3}
        />
      </div>
      
      <Button type="submit" className="w-full">
        Создать дело
      </Button>
    </form>
  )
}

// Edit Case Form Component
function EditCaseForm({ case_, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: case_?.title || '',
    client_name: case_?.client_name || '',
    description: case_?.description || '',
    priority: case_?.priority || 'medium',
    case_type: case_?.case_type || '',
    status: case_?.status || 'active'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit_title">Название дела</Label>
        <Input
          id="edit_title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          placeholder="Введите название дела"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="edit_client_name">Клиент</Label>
        <Input
          id="edit_client_name"
          value={formData.client_name}
          onChange={(e) => setFormData({...formData, client_name: e.target.value})}
          placeholder="Имя клиента"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="edit_case_type">Тип дела</Label>
        <Input
          id="edit_case_type"
          value={formData.case_type}
          onChange={(e) => setFormData({...formData, case_type: e.target.value})}
          placeholder="Гражданское, уголовное, административное..."
        />
      </div>
      
      <div>
        <Label htmlFor="edit_priority">Приоритет</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Низкий</SelectItem>
            <SelectItem value="medium">Средний</SelectItem>
            <SelectItem value="high">Высокий</SelectItem>
            <SelectItem value="urgent">Срочный</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="edit_status">Статус</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активное</SelectItem>
            <SelectItem value="paused">Приостановлено</SelectItem>
            <SelectItem value="completed">Завершено</SelectItem>
            <SelectItem value="archived">Архив</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="edit_description">Описание</Label>
        <Textarea
          id="edit_description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Краткое описание проблемы..."
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">
          Сохранить изменения
        </Button>
      </div>
    </form>
  )
}

// Case Details Component
function CaseDetails({ case_, documents, uploadProps, uploadProgress, ocrProgress, onPhotoClick }) {
  const { getRootProps, getInputProps, isDragActive } = uploadProps

  return (
    <div className="space-y-6">
      {/* Case Info Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{case_.title}</CardTitle>
              <CardDescription className="mt-2">
                Клиент: {case_.client_name} • Тип: {case_.case_type || 'Не указан'}
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Badge variant={case_.status === 'active' ? 'default' : 'secondary'}>
                {case_.status === 'active' ? 'Активное' : case_.status}
              </Badge>
              <Badge variant={case_.priority === 'urgent' ? 'destructive' : 'outline'}>
                {case_.priority === 'urgent' ? 'Срочно' : case_.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{case_.description}</p>
          <div className="mt-4 text-sm text-gray-500">
            Создано: {new Date(case_.created_at).toLocaleDateString('ru-RU')}
          </div>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Документы и фотографии
          </CardTitle>
          <CardDescription>
            Загрузите документы для автоматической OCR обработки
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Area */}
          <div 
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-500">Отпустите файлы здесь...</p>
            ) : (
              <>
                <p className="text-gray-600 mb-2">
                  Перетащите файлы сюда или нажмите для выбора
                </p>
                <p className="text-sm text-gray-500">
                  Поддерживаются изображения (JPG, PNG, GIF, BMP) и PDF до 10МБ
                </p>
              </>
            )}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium">Прогресс загрузки:</h4>
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <div key={fileId} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Загрузка {fileId.split('-').slice(1).join('-')}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </div>
          )}

          {/* OCR Progress */}
          {Object.keys(ocrProgress).length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium">Прогресс OCR обработки:</h4>
              {Object.entries(ocrProgress).map(([fileId, status]) => (
                <div key={fileId} className="border rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    {status.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                    {status.status === 'processing' && <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />}
                    {status.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {status.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    
                    <span className="text-sm font-medium">
                      {fileId.split('-').slice(1).join('-')}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {status.status === 'pending' && 'Ожидание'}
                      {status.status === 'processing' && 'Обработка'}
                      {status.status === 'completed' && 'Готово'}
                      {status.status === 'failed' && 'Ошибка'}
                    </Badge>
                  </div>
                  
                  {status.extractedText && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <strong>Распознанный текст:</strong>
                      <p className="mt-1">{status.extractedText.substring(0, 200)}...</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3">Загруженные документы:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map((doc, index) => (
                          <div
                            key={doc.id}
                            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                            onClick={() => onPhotoClick(doc, index)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="h-6 w-6 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.original_name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                                </p>
                                {doc.raw_text && (
                                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    <strong>OCR:</strong> {doc.raw_text.substring(0, 100)}...
                                  </div>
                                )}
                                <div className="mt-2 text-xs text-blue-600 font-medium">
                                  Нажмите для просмотра
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}