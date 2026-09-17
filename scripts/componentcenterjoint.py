# Joint to Component Center v1.0
# Created by Nicholas Crouse
from maya import cmds

if len(cmds.ls(selection=True)) < 1:
    cmds.warning("No Components Selected")
else:
    jt_rad = 0.1
    cl = cmds.cluster() [1]
    cmds.select(cl=True)
    jnt = cmds.joint(radius=jt_rad)
    cmds.matchTransform(jnt, cl)
    cmds.delete(cl)