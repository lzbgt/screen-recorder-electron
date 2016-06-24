Set objPPT  = CreateObject ("PowerPoint.Application")
dim r, g, b, color
r = CInt(WScript.Arguments(0))
g = CInt(WScript.Arguments(1))
b = CInt(WScript.Arguments(2))
color = r + g * 256 + b * 256 * 256
objPPT.ActivePresentation.SlideShowSettings.Run().View.PointerType = 2
objPPT.ActivePresentation.SlideShowSettings.Run().View.PointerColor.RGB = color