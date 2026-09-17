# Locator to Component Center v1.0
# Created by Nicholas Crouse
from maya import cmds

if len(cmds.ls(selection=True)) < 1:
    cmds.warning("No Components Selected")
else:
    cl = cmds.cluster() [1]
    loc = cmds.spaceLocator() [0]
    cmds.matchTransform(loc, cl)
    cmds.delete(cl)